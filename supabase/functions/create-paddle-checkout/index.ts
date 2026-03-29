// @ts-check
/**
 * Create Paddle Checkout
 * Creates a Paddle Billing transaction and returns the hosted checkout URL.
 *
 * Request: POST /functions/v1/create-paddle-checkout
 * Auth: Requires valid Google OAuth Bearer token
 *
 * Response: { checkoutUrl: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
);

const PADDLE_API_KEY = Deno.env.get('PADDLE_API_KEY') || '';
const PADDLE_PRICE_ID = Deno.env.get('PADDLE_PRICE_ID') || '';

// Use Paddle sandbox API in non-production; switch to api.paddle.com for production
const PADDLE_API_BASE = Deno.env.get('PADDLE_ENVIRONMENT') === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

// Hosted checkout base URL from Paddle dashboard (Checkout > Hosted Checkout).
// For Chrome extensions (no domain), we use Paddle's fully-hosted checkout page
// instead of the transaction checkout.url, which requires Paddle.js on your domain.
// Create one at: Paddle sandbox > Checkout > Hosted checkout > New hosted checkout
const PADDLE_HOSTED_CHECKOUT_URL = Deno.env.get('PADDLE_HOSTED_CHECKOUT_URL') || '';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

/**
 * Main handler — creates a Paddle checkout transaction for the authenticated user.
 */
export async function handler(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (req.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        const token = extractToken(req.headers.get('authorization') || '');
        if (!token) {
            return errorResponse('Missing or invalid authorization token', 401);
        }

        // Resolve user email from Google OAuth token
        const googleEmail = await resolveEmailFromGoogleToken(token);
        if (!googleEmail) {
            return errorResponse('Could not resolve user from token', 401);
        }

        // Look up or create user profile
        let { data: profile } = await supabase
            .from('user_profiles')
            .select('id, email')
            .eq('email', googleEmail)
            .single();

        if (!profile) {
            const { data: created, error: createError } = await supabase
                .from('user_profiles')
                .insert({ id: crypto.randomUUID(), email: googleEmail, plan_type: 'free' })
                .select('id, email')
                .single();

            if (!created || createError) {
                return errorResponse(
                    `Failed to create user profile | email=${googleEmail} | error=${JSON.stringify(createError)}`,
                    500,
                );
            }
            profile = created;
        }

        // Create Paddle transaction (generates a hosted checkout URL)
        const paddleResponse = await fetch(`${PADDLE_API_BASE}/transactions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PADDLE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: [{ price_id: PADDLE_PRICE_ID, quantity: 1 }],
                customer: { email: googleEmail },
                custom_data: { user_id: profile.id },
            }),
        });

        if (!paddleResponse.ok) {
            const errorText = await paddleResponse.text();
            console.error('Paddle API error:', errorText);
            return errorResponse('Failed to create Paddle checkout session', 500);
        }

        const paddleData = await paddleResponse.json();
        const txnId = paddleData?.data?.id;

        if (!txnId) {
            return errorResponse('No transaction ID returned from Paddle', 500);
        }

        if (!PADDLE_HOSTED_CHECKOUT_URL) {
            return errorResponse('PADDLE_HOSTED_CHECKOUT_URL is not configured', 500);
        }

        // Append transaction_id so Paddle's hosted checkout page uses the
        // pre-created transaction (which carries our custom_data.user_id for
        // the webhook to activate the subscription).
        // After payment Paddle redirects to the URL configured in the hosted
        // checkout dashboard — set to https://customer-portal.paddle.com/
        // where customers can log in with their email to manage their account.
        const checkoutUrl = `${PADDLE_HOSTED_CHECKOUT_URL}?transaction_id=${txnId}`;

        return successResponse({ checkoutUrl });
    } catch (error) {
        console.error('Checkout creation error:', error);
        return errorResponse('Failed to create checkout session', 500);
    }
}

/**
 * Resolve email from a Google OAuth access token via Google userinfo endpoint.
 */
async function resolveEmailFromGoogleToken(token: string): Promise<string | null> {
    try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const info = await res.json();
        return info.email || null;
    } catch {
        return null;
    }
}

/**
 * Extract Bearer token from Authorization header.
 */
function extractToken(authHeader: string): string | null {
    if (!authHeader.startsWith('Bearer ')) return null;
    return authHeader.substring(7);
}

function successResponse(data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
}

function errorResponse(message: string, status: number): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
}

Deno.serve(handler);
