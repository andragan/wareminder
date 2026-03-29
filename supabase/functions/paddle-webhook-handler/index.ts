// @ts-check
/**
 * Paddle Webhook Handler
 * Receives and processes Paddle billing events:
 *   - transaction.completed  → activate/renew subscription
 *   - subscription.canceled  → mark as cancelled_pending
 *   - subscription.payment.failed → mark as past_due
 *
 * Signature verification: HMAC-SHA256 using the `Paddle-Signature` header.
 * See: https://developer.paddle.com/webhooks/signature-verification
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    { db: { schema: 'public' } },
);

const PADDLE_WEBHOOK_SECRET = Deno.env.get('PADDLE_WEBHOOK_SECRET') || '';

/**
 * Main handler — verifies Paddle signature then dispatches event.
 */
export async function handler(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const rawBody = await req.text();
        const signatureHeader = req.headers.get('paddle-signature');

        if (!signatureHeader) {
            return new Response('Missing Paddle-Signature header', { status: 400 });
        }

        const isValid = await verifyPaddleSignature(rawBody, signatureHeader);
        if (!isValid) {
            console.error('Invalid Paddle webhook signature');
            return new Response('Invalid signature', { status: 401 });
        }

        const event = JSON.parse(rawBody);
        console.log(`Processing Paddle event: ${event.event_type}, notification_id: ${event.notification_id}`);

        switch (event.event_type) {
            case 'transaction.completed':
                await handleTransactionCompleted(event.data);
                break;
            case 'subscription.canceled':
                await handleSubscriptionCanceled(event.data);
                break;
            case 'subscription.payment.failed':
                await handlePaymentFailed(event.data);
                break;
            default:
                console.log(`Unhandled Paddle event type: ${event.event_type}`);
        }

        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('Webhook processing error:', error);
        return new Response('Internal server error', { status: 500 });
    }
}

/**
 * Verify Paddle webhook signature using HMAC-SHA256.
 * Paddle signature format: "ts=<timestamp>;h1=<hmac>"
 * Signed payload: "<timestamp>:<raw_body>"
 */
async function verifyPaddleSignature(rawBody: string, signatureHeader: string): Promise<boolean> {
    try {
        const parts = Object.fromEntries(
            signatureHeader.split(';').map((part) => part.split('=')),
        );
        const timestamp = parts['ts'];
        const receivedHmac = parts['h1'];

        if (!timestamp || !receivedHmac) return false;

        const payload = `${timestamp}:${rawBody}`;
        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(PADDLE_WEBHOOK_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign'],
        );
        const signatureBuffer = await crypto.subtle.sign(
            'HMAC',
            key,
            new TextEncoder().encode(payload),
        );
        const computedHmac = Array.from(new Uint8Array(signatureBuffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

        return computedHmac === receivedHmac;
    } catch {
        return false;
    }
}

/**
 * Handle transaction.completed — activate or renew subscription.
 */
async function handleTransactionCompleted(data: any): Promise<void> {
    const userId = data?.custom_data?.user_id;
    if (!userId) {
        console.error('transaction.completed: missing custom_data.user_id');
        return;
    }

    const nextBillingDate = data?.billing_period?.ends_at || null;
    const currentPeriodStart = data?.billing_period?.starts_at || new Date().toISOString();
    const paddleTransactionId = data?.id || null;

    const { error } = await supabase
        .from('subscriptions')
        .upsert(
            {
                user_id: userId,
                plan_type: 'premium',
                status: 'active',
                current_period_start: currentPeriodStart,
                current_period_end: nextBillingDate,
                next_billing_date: nextBillingDate,
                paddle_transaction_id: paddleTransactionId,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
        );

    if (error) {
        console.error('Error upserting subscription on transaction.completed:', error);
    } else {
        console.log(`Subscription activated for user ${userId}`);
    }
}

/**
 * Handle subscription.canceled — set status to cancelled_pending.
 */
async function handleSubscriptionCanceled(data: any): Promise<void> {
    const userId = data?.custom_data?.user_id;
    if (!userId) {
        console.error('subscription.canceled: missing custom_data.user_id');
        return;
    }

    const currentPeriodEnd = data?.current_billing_period?.ends_at || null;

    const { error } = await supabase
        .from('subscriptions')
        .update({
            status: 'cancelled_pending',
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

    if (error) {
        console.error('Error updating subscription on subscription.canceled:', error);
    } else {
        console.log(`Subscription marked cancelled_pending for user ${userId}`);
    }
}

/**
 * Handle subscription.payment.failed — set status to past_due.
 */
async function handlePaymentFailed(data: any): Promise<void> {
    const userId = data?.custom_data?.user_id;
    if (!userId) {
        console.error('subscription.payment.failed: missing custom_data.user_id');
        return;
    }

    const { error } = await supabase
        .from('subscriptions')
        .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

    if (error) {
        console.error('Error updating subscription on subscription.payment.failed:', error);
    } else {
        console.log(`Subscription marked past_due for user ${userId}`);
    }
}

Deno.serve(handler);
