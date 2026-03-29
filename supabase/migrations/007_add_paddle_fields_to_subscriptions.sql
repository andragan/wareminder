-- Migration: 007_add_paddle_fields_to_subscriptions.sql
-- Purpose: Add Paddle-specific fields and fix status CHECK constraint for Paddle billing events

-- Add paddle_transaction_id column
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS paddle_transaction_id TEXT;

-- Fix status CHECK constraint to include Paddle billing statuses.
-- Drop the old constraint and add a new one that covers all statuses used by
-- both the existing code and the new paddle-webhook-handler.
ALTER TABLE public.subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'cancelled', 'cancelled_pending', 'grace_period', 'past_due', 'trial'));
