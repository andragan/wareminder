-- Migration: 009_drop_stripe_columns_from_subscriptions.sql
-- Purpose: Remove Stripe-specific columns now that Paddle is the payment provider.
-- Xendit never used these columns either. paddle_transaction_id (added in 007)
-- is the equivalent identifier for Paddle transactions.

ALTER TABLE public.subscriptions
    DROP COLUMN IF EXISTS stripe_customer_id,
    DROP COLUMN IF EXISTS stripe_subscription_id;

DROP INDEX IF EXISTS idx_subscriptions_stripe_customer_id;
DROP INDEX IF EXISTS idx_subscriptions_stripe_subscription_id;
