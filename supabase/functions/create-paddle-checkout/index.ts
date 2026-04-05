// @ts-check
/**
 * Create Paddle Checkout
 * Creates a Paddle Billing transaction and returns the hosted checkout URL.
 * Uses Supabase JWT auth — user_profiles has been removed; identity anchored to auth.users.
 *
 * Request: POST /functions/v1/create-paddle-checkout
 * Auth: Requires valid Supabase JWT (Bearer token issued by Supabase Auth)
 *
 * Response: { checkoutUrl: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { jwtDecode } from 'https://esm.sh/jwt-decode@4.0.0';

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

        // Create Paddle transaction (generates a hosted checkout URL).
        // custom_data.user_id is auth.users.id — the webhook uses this to key the subscription.
        const paddleResponse = await fetch(`${PADDLE_API_BASE}/transactions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PADDLE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: [{ price_id: PADDLE_PRICE_ID, quantity: 1 }],
                customer: { email: userEmail },
                custom_data: { user_id: userId },
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

        // Append transaction_id so Paddle's hosted checkout page uses the pre-created
        // transaction (which carries our custom_data.user_id for the webhook to activate
        // the subscription).
        const checkoutUrl = `${PADDLE_HOSTED_CHECKOUT_URL}?transaction_id=${txnId}`;

        return successResponse({ checkoutUrl });
    } catch (error) {
        console.error('Checkout creation error:', error);
        return errorResponse('Failed to create checkout session', 500);
    }
}

/**
 * Extract Bearer token from Authorization header.
 */
function extractToken(authHeader: string): string | null {
    if (!authHeader.startsWith('Bearer ')) return null;
    return authHeader.substring(7);
}

/** Minimal JWT payload shape for Supabase tokens */
interface SupabaseJwtPayload {
    sub?: string;
    [key: string]: unknown;
}

/**
 * Extract user ID (sub claim) from Supabase JWT.
 */
function extractUserId(token: string): string | null {
    try {
        const decoded = jwtDecode<SupabaseJwtPayload>(token);
        return decoded.sub || null;
    } catch {
        return null;
    }
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
