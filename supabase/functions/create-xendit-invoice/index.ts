// @ts-check
/**
 * Create Xendit Invoice
 * Initiates a Xendit invoice for premium subscription upgrade
 * 
 * Request: POST /functions/v1/create-xendit-invoice
 * Body: { user_id: UUID }
 * Auth: Requires valid Supabase JWT token
 * 
 * Response: { invoiceUrl: string, invoiceId: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

const XENDIT_SECRET_KEY = Deno.env.get('XENDIT_SECRET_KEY') || '';
const XENDIT_API_URL = 'https://api.xendit.co';
const TRIAL_DAYS = 14;
const XENDIT_AMOUNT_IDR = parseInt(Deno.env.get('XENDIT_AMOUNT_IDR') || '99900');
const XENDIT_CURRENCY = Deno.env.get('XENDIT_CURRENCY') || 'IDR';

/**
 * Main handler - creates Xendit invoice for trial or upgrade
 */
export async function handler(req: Request): Promise<Response> {
  // Only handle POST requests
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Verify JWT token in Authorization header
    const token = extractToken(req.headers.get('authorization') || '');
    if (!token) {
      return errorResponse('Missing or invalid authorization token', 401);
    }

    const userId = extractUserId(token);
    if (!userId) {
      return errorResponse('Invalid token - missing user ID', 401);
    }

    // Get user profile for email and name
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('email, display_name')
      .eq('id', userId)
      .single();

    if (!profile || profileError) {
      return errorResponse('User profile not found', 404);
    }

    // Create Xendit invoice
    const invoiceData = {
      external_id: `wareminder_${userId}_${Date.now()}`,
      amount: XENDIT_AMOUNT_IDR,
      payer_email: profile.email,
      payer_name: profile.display_name || profile.email,
      description: 'WAReminder Premium Monthly Subscription',
      invoice_duration: 86400,  // 24 hours to pay
      currency: XENDIT_CURRENCY,
      items: [
        {
          name: 'Premium Subscription',
          quantity: 1,
          price: XENDIT_AMOUNT_IDR,
        },
      ],
      metadata: {
        user_id: userId,
        plan_type: 'premium',
        trial_days: TRIAL_DAYS,
      },
    };

    // Create invoice via Xendit API
    const invoiceResponse = await createXenditInvoice(invoiceData);

    if (!invoiceResponse.id) {
      return errorResponse('Failed to create Xendit invoice', 500);
    }

    // Create subscription record with trial status
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const { error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        xendit_customer_id: profile.email,
        xendit_invoice_id: invoiceResponse.id,
        plan_type: 'premium',
        status: 'trial',
        trial_started_at: now.toISOString(),
        trial_end_date: trialEndDate.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: trialEndDate.toISOString(),
        next_billing_date: trialEndDate.toISOString(),
      });

    if (subError) {
      console.error('Error creating subscription:', subError);
    }

    // Log event
    await supabase
      .from('subscription_events')
      .insert({
        user_id: userId,
        event_type: 'TRIAL_STARTED',
        event_data: {
          trial_days: TRIAL_DAYS,
          trial_end_date: trialEndDate.toISOString(),
          invoice_id: invoiceResponse.id,
        },
        created_at: new Date().toISOString(),
      })
      .catch((err) => console.error('Error logging subscription event:', err));

    return successResponse({
      invoiceUrl: invoiceResponse.invoice_url,
      invoiceId: invoiceResponse.id,
      trialDays: TRIAL_DAYS,
      externalId: invoiceData.external_id,
    });
  } catch (error) {
    console.error('Invoice creation error:', error);
    return errorResponse('Failed to create invoice', 500);
  }
}

/**
 * Create invoice via Xendit API
 */
async function createXenditInvoice(invoiceData: any): Promise<any> {
  try {
    const response = await fetch(`${XENDIT_API_URL}/v2/invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(XENDIT_SECRET_KEY + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoiceData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Xendit API error: ${errorData.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Xendit API error:', error);
    throw error;
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
    // Decode JWT payload (basic decoding without verification, server already verified it)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = JSON.parse(
      new TextDecoder().decode(
        Deno.core.decode(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
      )
    );
    
    return payload.sub || null; // Supabase uses 'sub' claim for user ID
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
