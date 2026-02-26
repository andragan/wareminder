// @ts-check
/**
 * Xendit Webhook Handler
 * Receives and processes Xendit payment events: invoice.paid, invoice.expired,
 * recurring_payment.succeeded, recurring_payment.failed
 * 
 * Triggered by: POST requests from Xendit to this function's endpoint
 * Events processed:
 * - invoice.paid: Invoice payment successful, update subscription status
 * - invoice.expired: Invoice expired without payment, initiate grace period
 * - recurring_payment.succeeded: Recurring payment successful, extend billing period
 * - recurring_payment.failed: Recurring payment failed, initiate grace period
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Initialize Supabase client (use service role for backend operations)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  { db: { schema: 'public' } }
);

// Xendit webhook verification token
const WEBHOOK_TOKEN = Deno.env.get('XENDIT_WEBHOOK_TOKEN') || '';

/**
 * Main webhook handler - receives and verifies Xendit events
 * POST body should contain Xendit event JSON
 * Header 'x-callback-token' contains HMAC signature for verification
 */
export async function handler(req: Request): Promise<Response> {
  // Only handle POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get raw body for signature verification
    const body = await req.text();
    const callbackToken = req.headers.get('x-callback-token');

    if (!callbackToken) {
      return new Response('Missing x-callback-token header', { status: 400 });
    }

    // Verify webhook token matches configured token
    if (callbackToken !== WEBHOOK_TOKEN) {
      console.error('Invalid Xendit webhook token');
      return new Response('Invalid webhook token', { status: 401 });
    }

    // Parse the event
    const event = JSON.parse(body);

    // Log event for debugging
    console.log(`Processing Xendit event: ${event.event}, ID: ${event.id}`);

    // Handle different event types
    switch (event.event) {
      case 'invoice.paid':
        await handleInvoicePaid(event.data);
        break;

      case 'invoice.expired':
        await handleInvoiceExpired(event.data);
        break;

      case 'recurring_payment.succeeded':
        await handleRecurringPaymentSucceeded(event.data);
        break;

      case 'recurring_payment.failed':
        await handleRecurringPaymentFailed(event.data);
        break;

      default:
        // Silently ignore other event types
        console.log(`Unhandled Xendit event type: ${event.event}`);
    }

    // Return success to Xendit (prevents retries)
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Return 400 to tell Xendit this was a bad request (they'll retry)
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle successful invoice payment
 * Updates subscription status to 'active' and records transaction
 */
async function handleInvoicePaid(data: any): Promise<void> {
  const { id: invoiceId, customer: { id: customerId }, amount, currency } = data;

  try {
    // Extract user_id from Xendit metadata or customer description
    const userId = data.customer?.reference_id || data.metadata?.user_id;
    if (!userId) {
      console.error('No user_id found in invoice metadata');
      return;
    }

    // Get subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'grace_period')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Update subscription status if in grace period, otherwise create payment record
    if (subscription && !subError) {
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          grace_period_start_date: null,
          grace_period_end_date: null,
          payment_retry_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) {
        console.error('Error updating subscription:', updateError);
      }
    }

    // Record payment transaction
    const { error: txError } = await supabase
      .from('payment_transactions')
      .insert({
        subscription_id: subscription?.id,
        user_id: userId,
        amount_cents: Math.round(amount * 100),
        currency: currency,
        xendit_invoice_id: invoiceId,
        status: 'success',
        created_at: new Date().toISOString(),
      });

    if (txError) {
      console.error('Error recording transaction:', txError);
    }

    // Log event
    await logSubscriptionEvent(userId, 'PAYMENT_SUCCESS', {
      invoiceId,
      amount,
      currency,
    });
  } catch (error) {
    console.error('Error handling invoice.paid:', error);
  }
}

/**
 * Handle invoice expiration (user didn't pay)
 * Initiates grace period for retry
 */
async function handleInvoiceExpired(data: any): Promise<void> {
  const { id: invoiceId, customer: { id: customerId }, amount } = data;

  try {
    const userId = data.customer?.reference_id || data.metadata?.user_id;
    if (!userId) {
      console.error('No user_id found in invoice metadata');
      return;
    }

    // Get active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subscription && !subError) {
      // Calculate grace period end date (3 days from now)
      const gracePeriodEndDate = new Date();
      gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + 3);

      // Update to grace period status
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'grace_period',
          grace_period_start_date: new Date().toISOString(),
          grace_period_end_date: gracePeriodEndDate.toISOString(),
          payment_retry_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) {
        console.error('Error updating subscription to grace period:', updateError);
      }
    }

    // Record failed transaction
    await supabase
      .from('payment_transactions')
      .insert({
        subscription_id: subscription?.id,
        user_id: userId,
        amount_cents: Math.round(amount * 100),
        currency: 'IDR',
        xendit_invoice_id: invoiceId,
        status: 'failed',
        failure_reason: 'Invoice expired without payment',
        created_at: new Date().toISOString(),
      });

    // Log event
    await logSubscriptionEvent(userId, 'GRACE_PERIOD_STARTED', {
      invoiceId,
      gracePeriodDays: 3,
    });
  } catch (error) {
    console.error('Error handling invoice.expired:', error);
  }
}

/**
 * Handle successful recurring payment
 * Updates billing period and extends subscription
 */
async function handleRecurringPaymentSucceeded(data: any): Promise<void> {
  const { id: chargeId, reference_id: invoiceId, amount } = data;

  try {
    const userId = data.metadata?.user_id;
    if (!userId) {
      console.error('No user_id found in payment metadata');
      return;
    }

    // Get subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subscription) {
      // Calculate new billing period
      const currentPeriodEnd = new Date(subscription.current_period_end);
      const newPeriodEnd = new Date(currentPeriodEnd);
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

      // Update billing dates
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          current_period_start: currentPeriodEnd.toISOString(),
          current_period_end: newPeriodEnd.toISOString(),
          next_billing_date: newPeriodEnd.toISOString(),
          payment_retry_count: 0,
          grace_period_start_date: null,
          grace_period_end_date: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) {
        console.error('Error updating subscription period:', updateError);
      }
    }

    // Record transaction
    await supabase
      .from('payment_transactions')
      .insert({
        subscription_id: subscription?.id,
        user_id: userId,
        amount_cents: Math.round(amount * 100),
        currency: 'IDR',
        xendit_charge_id: chargeId,
        xendit_invoice_id: invoiceId,
        status: 'success',
        created_at: new Date().toISOString(),
      });

    // Log event
    await logSubscriptionEvent(userId, 'SUBSCRIPTION_RENEWED', {
      chargeId,
      amount,
    });
  } catch (error) {
    console.error('Error handling recurring_payment.succeeded:', error);
  }
}

/**
 * Handle failed recurring payment
 * Initiates grace period for retry
 */
async function handleRecurringPaymentFailed(data: any): Promise<void> {
  const { id: chargeId, failure_reason: reason, amount } = data;

  try {
    const userId = data.metadata?.user_id;
    if (!userId) {
      console.error('No user_id found in payment metadata');
      return;
    }

    // Get active subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subscription) {
      // Calculate grace period
      const gracePeriodEndDate = new Date();
      gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + 3);

      // Update to grace period
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'grace_period',
          grace_period_start_date: new Date().toISOString(),
          grace_period_end_date: gracePeriodEndDate.toISOString(),
          payment_retry_count: (subscription.payment_retry_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) {
        console.error('Error updating subscription:', updateError);
      }
    }

    // Record failed transaction
    await supabase
      .from('payment_transactions')
      .insert({
        subscription_id: subscription?.id,
        user_id: userId,
        amount_cents: Math.round(amount * 100),
        currency: 'IDR',
        xendit_charge_id: chargeId,
        status: 'failed',
        failure_reason: reason || 'Payment method failed',
        created_at: new Date().toISOString(),
      });

    // Log event
    await logSubscriptionEvent(userId, 'PAYMENT_FAILED', {
      chargeId,
      reason,
      gracePeriodDays: 3,
    });
  } catch (error) {
    console.error('Error handling recurring_payment.failed:', error);
  }
}

/**
 * Helper: Log subscription event to audit trail
 */
async function logSubscriptionEvent(
  userId: string,
  eventType: string,
  eventData: any = {}
): Promise<void> {
  const { error } = await supabase.from('subscription_events').insert({
    user_id: userId,
    event_type: eventType,
    event_data: eventData,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Error logging subscription event:', error);
  }
}

Deno.serve(handler);
