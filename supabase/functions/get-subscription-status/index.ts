// @ts-check
/**
 * Get Subscription Status
 * Returns current user subscription state derived solely from the subscriptions table.
 * user_profiles has been removed; identity is anchored to auth.users.
 *
 * Request: GET /functions/v1/get-subscription-status
 * Auth: Requires valid Supabase JWT (Bearer token issued by Supabase Auth)
 *
 * Response: {
 *   user_id: string,
 *   plan_type: 'free' | 'premium',
 *   status: 'active' | 'trial' | 'grace_period' | 'cancelled' | 'cancelled_pending' | 'past_due' | 'downgraded',
 *   reminder_limit: number,           // 5 for free, -1 for premium
 *   trial_end_date?: ISO string,
 *   next_billing_date?: ISO string,
 *   current_period_end?: ISO string,
 *   grace_period_end_date?: ISO string,
 *   cancellation_date?: ISO string,
 *   downgrade_reason?: string,
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { jwtDecode } from 'https://esm.sh/jwt-decode@4.0.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

/** Statuses that grant premium access */
const PREMIUM_STATUSES = new Set(['active', 'trial', 'grace_period', 'cancelled_pending']);

/**
 * Main handler - returns subscription status
 */
export async function handler(req: Request): Promise<Response> {
  // CORS: allow Chrome extension origin
  const CORS_ORIGIN = "chrome-extension://dlghdpeofiljpkjopohgfpkheoplogof";

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": CORS_ORIGIN,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Only handle GET requests
  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405, CORS_ORIGIN);
  }

  try {
    // Verify JWT token (must be a Supabase-issued JWT)
    const token = extractToken(req.headers.get('authorization') || '');
    if (!token) {
      return errorResponse('Missing or invalid authorization token', 401, CORS_ORIGIN);
    }

    const userId = extractUserId(token);
    if (!userId) {
      return errorResponse('Invalid token - missing user ID', 401, CORS_ORIGIN);
    }

    // Derive plan entirely from subscriptions table — no user_profiles lookup
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select(
        'id, plan_type, status, trial_end_date, current_period_end, next_billing_date, grace_period_end_date, cancellation_date'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error('Error querying subscriptions:', subError);
      return errorResponse('Failed to fetch subscription data', 500, CORS_ORIGIN);
    }

    // No subscription record → free tier
    if (!subscription) {
      return successResponse({
        user_id: userId,
        plan_type: 'free',
        status: 'active',
        reminder_limit: 5,
      }, CORS_ORIGIN);
    }

    // Check for grace period expiry
    if (subscription.status === 'grace_period' && subscription.grace_period_end_date) {
      const now = new Date();
      const gracePeriodEnd = new Date(subscription.grace_period_end_date);

      if (now > gracePeriodEnd) {
        // Grace period has expired — downgrade subscription status
        await supabase
          .from('subscriptions')
          .update({
            status: 'downgraded',
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);

        // Log the downgrade event
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

        return successResponse({
          user_id: userId,
          plan_type: 'free',
          status: 'downgraded',
          reminder_limit: 5,
          downgrade_reason: 'grace_period_expired',
          downgrade_date: gracePeriodEnd.toISOString(),
        }, CORS_ORIGIN);
      }
    }

    // Derive plan_type from subscription status — subscriptions table is the single source
    const isPremium = PREMIUM_STATUSES.has(subscription.status);
    const planType = isPremium ? 'premium' : 'free';
    const reminderLimit = isPremium ? -1 : 5;

    return successResponse({
      user_id: userId,
      plan_type: planType,
      status: subscription.status,
      reminder_limit: reminderLimit,
      trial_end_date: subscription.trial_end_date,
      next_billing_date: subscription.next_billing_date,
      current_period_end: subscription.current_period_end,
      grace_period_end_date: subscription.grace_period_end_date,
      cancellation_date: subscription.cancellation_date,
    }, CORS_ORIGIN);
  } catch (error) {
    console.error('Subscription status fetch error:', error);
    return errorResponse('Failed to fetch subscription status', 500, CORS_ORIGIN);
  }
}

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(authHeader: string): string | null {
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/** Minimal JWT payload shape for Supabase tokens */
interface SupabaseJwtPayload {
  sub?: string;
  [key: string]: unknown;
}

/**
 * Extract user ID (sub claim) from Supabase JWT
 */
function extractUserId(token: string): string | null {
  try {
    const decoded = jwtDecode<SupabaseJwtPayload>(token);
    return decoded.sub || null;
  } catch {
    return null;
  }
}

/**
 * Return success response with CORS header
 */
function successResponse(data: unknown, origin?: string): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    },
  });
}

/**
 * Return error response with CORS header
 */
function errorResponse(message: string, status: number, origin?: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    },
  });
}

Deno.serve(handler);
