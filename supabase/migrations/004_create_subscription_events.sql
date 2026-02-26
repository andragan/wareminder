-- Migration: 004_create_subscription_events.sql
-- Purpose: Create subscription_events table for immutable audit trail of subscription state changes
-- Created: 2026-02-27

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  
  -- Event type and source
  event_type TEXT NOT NULL CHECK (event_type IN (
    'payment_success',
    'payment_failed',
    'trial_ended',
    'subscription_renewed',
    'subscription_cancelled',
    'downgrade_initiated',
    'grace_period_started',
    'grace_period_ended',
    'payment_retry_attempted',
    'reactivation_attempted'
  )),
  event_source TEXT NOT NULL DEFAULT 'stripe' CHECK (event_source IN ('stripe', 'manual', 'system', 'user')),
  
  -- Event data (JSON for flexibility)
  event_data JSONB,
  
  -- External reference (Stripe event ID if applicable)
  external_event_id TEXT,
  
  -- Audit trail (immutable - no updates)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own events (for debugging/support)
CREATE POLICY subscription_events_select_own ON public.subscription_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription_id ON public.subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON public.subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_event_type ON public.subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_event_source ON public.subscription_events(event_source);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON public.subscription_events(created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_events_external_id ON public.subscription_events(external_event_id);

-- Constraint: No deletes allowed (immutable audit trail)
CREATE OR REPLACE FUNCTION public.prevent_subscription_events_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Subscription events cannot be deleted (immutable audit trail)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_subscription_events_deletion
BEFORE DELETE ON public.subscription_events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_subscription_events_deletion();

-- Constraint: No updates allowed (immutable audit trail)
CREATE OR REPLACE FUNCTION public.prevent_subscription_events_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Subscription events cannot be updated (immutable audit trail)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_subscription_events_update
BEFORE UPDATE ON public.subscription_events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_subscription_events_update();

COMMENT ON TABLE public.subscription_events IS 'Immutable audit trail of all subscription state changes for compliance, debugging, and dispute resolution';
COMMENT ON COLUMN public.subscription_events.event_type IS 'Type of subscription event that occurred';
COMMENT ON COLUMN public.subscription_events.event_source IS 'Source of event: stripe (webhook), manual (admin), system (cron), user (action)';
COMMENT ON COLUMN public.subscription_events.event_data IS 'JSON data specific to event type (e.g., error_message for payment_failed, reason for cancellation)';
COMMENT ON COLUMN public.subscription_events.external_event_id IS 'Stripe event ID for tracking webhook processing and idempotency';
