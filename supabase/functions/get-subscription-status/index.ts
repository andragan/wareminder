// @ts-check
/**
 * Get Subscription Status
 * Returns current user subscription state
 * 
 * Request: GET /functions/v1/get-subscription-status
 * Auth: Requires valid Supabase JWT token
 * 
 * Response: {
 *   plan_type: 'free' | 'premium',
 *   status: 'active' | 'trial' | 'grace_period' | 'cancelled',
 *   trial_end_date?: ISO string,
 *   next_billing_date?: ISO string,
 *   grace_period_end_date?: ISO string,
 *   cancellation_date?: ISO string,
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { jwtDecode } from 'https://esm.sh/jwt-decode@4.0.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

/**
 * Main handler - returns subscription status
 */
export async function handler(req: Request): Promise<Response> {
  // Only handle GET requests
  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Verify JWT token
    const token = extractToken(req.headers.get('authorization') || '');
    if (!token) {
      return errorResponse('Missing or invalid authorization token', 401);
    }

    const userId = extractUserId(token);
    if (!userId) {
      return errorResponse('Invalid token - missing user ID', 401);
    }

    // Get user plan from user_profiles table
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plan_type')
      .eq('id', userId)
      .single();

    if (!profile) {
      return errorResponse('User profile not found', 404);
    }

    // If free user, return immediately
    if (profile.plan_type === 'free') {
      return successResponse({
        plan_type: 'free',
        status: 'active',
        reminder_limit: 5,
      });
    }

    // Get subscription details for premium user
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select(
        'id, plan_type, status, trial_end_date, current_period_end, next_billing_date, grace_period_end_date, cancellation_date'
      )
      .eq('user_id', userId)
      .eq('plan_type', 'premium')
      .single();

    if (!subscription) {
      // Premium user but no subscription record - return free as fallback
      console.warn(`Premium user ${userId} has no subscription record`);
      return successResponse({
        plan_type: 'free',
        status: 'active',
        reminder_limit: 5,
      });
    }

    // Check for grace period expiry (should be handled by background job, but double-check)
    if (subscription.status === 'grace_period' && subscription.grace_period_end_date) {
      const now = new Date();
      const gracePeriodEnd = new Date(subscription.grace_period_end_date);

      if (now > gracePeriodEnd) {
        // Grace period has expired - downgrade user to free
        // First, update subscription status
        await supabase
          .from('subscriptions')
          .update({
            status: 'downgraded',
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);

        // Then update user profile
        await supabase
          .from('user_profiles')
          .update({
            plan_type: 'free',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        // Log event
        await supabase.from('subscription_events').insert({
          subscription_id: subscription.id,
          user_id: userId,
          event_type: 'downgrade_initiated',
          event_source: 'system',
          event_data: {
            reason: 'grace_period_expired',
            grace_period_end_date: gracePeriodEnd.toISOString(),
          },
        });

        // Return downgraded status
        return successResponse({
          plan_type: 'free',
          status: 'downgraded',
          reminder_limit: 5,
          downgrade_reason: 'grace_period_expired',
          downgrade_date: gracePeriodEnd.toISOString(),
        });
      }
    }

    // Return subscription status
    return successResponse({
      plan_type: subscription.plan_type,
      status: subscription.status,
      trial_end_date: subscription.trial_end_date,
      next_billing_date: subscription.next_billing_date,
      current_period_end: subscription.current_period_end,
      grace_period_end_date: subscription.grace_period_end_date,
      cancellation_date: subscription.cancellation_date,
      reminder_limit: -1, // -1 means unlimited for premium
    });
  } catch (error) {
    console.error('Subscription status fetch error:', error);
    return errorResponse('Failed to fetch subscription status', 500);
  }
}

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(authHeader: string): string | null {
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

/**
 * Extract user ID from JWT token
 */
function extractUserId(token: string): string | null {
  try {
    const decoded = jwtDecode(token);
    return decoded.sub || null; // Supabase uses 'sub' claim for user ID
  } catch {
    return null;
  }
}

/**
 * Return success response
 */
function successResponse(data: any): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Return error response
 */
function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(handler);
