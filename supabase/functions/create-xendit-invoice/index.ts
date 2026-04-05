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
import { jwtDecode } from 'https://esm.sh/jwt-decode@4.0.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

const XENDIT_SECRET_KEY = Deno.env.get('XENDIT_SECRET_KEY') || '';
const XENDIT_API_URL = 'https://api.xendit.co';
const TRIAL_DAYS = 14;
const XENDIT_AMOUNT_IDR = parseInt(Deno.env.get('XENDIT_AMOUNT_IDR') || '99900');
const XENDIT_CURRENCY = Deno.env.get('XENDIT_CURRENCY') || 'IDR';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

/**
 * Main handler - creates Xendit invoice for trial or upgrade
 */
export async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only handle POST requests
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Authenticate via Supabase JWT
    const token = extractToken(req.headers.get('authorization') || '');
    if (!token) {
      return errorResponse('Missing or invalid authorization token', 401);
    }

    const userId = extractUserId(token);
    if (!userId) {
      return errorResponse('Invalid token - missing user ID', 401);
    }

    // Resolve user email from auth.users via service role
    const { data: authUser, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !authUser?.user) {
      return errorResponse('Could not resolve user from token', 401);
    }
    const userEmail = authUser.user.email;
    if (!userEmail) {
      return errorResponse('User account has no email address', 422);
    }

    // Create Xendit invoice
    const invoiceData = {
      external_id: `wareminder_${userId}_${Date.now()}`,
      amount: XENDIT_AMOUNT_IDR,
      payer_email: userEmail,
      payer_name: userEmail,
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
        xendit_customer_id: userEmail,
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
    supabase
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
      .then(({ error: eventError }) => {
        if (eventError) console.error('Error logging subscription event:', eventError);
      });

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
 * Return success response
 */
function successResponse(data: any): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/**
 * Return error response
 */
function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

Deno.serve(handler);
