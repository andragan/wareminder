-- Migration: 002_create_subscriptions.sql
-- Purpose: Create subscriptions table to manage subscription state machine and billing details
-- Created: 2026-02-27

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'premium')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'grace_period', 'trial')),
  
  -- Trial period tracking
  trial_end_date TIMESTAMP WITH TIME ZONE,
  trial_started_at TIMESTAMP WITH TIME ZONE,
  
  -- Billing cycle dates
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  
  -- Grace period (for payment failures)
  grace_period_start_date TIMESTAMP WITH TIME ZONE,
  grace_period_end_date TIMESTAMP WITH TIME ZONE,
  last_payment_retry_at TIMESTAMP WITH TIME ZONE,
  payment_retry_count INTEGER DEFAULT 0,
  
  -- Cancellation tracking
  cancellation_date TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  
  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own subscriptions
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY subscriptions_update_own ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY subscriptions_insert_own ON public.subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_grace_period_end ON public.subscriptions(grace_period_end_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing_date ON public.subscriptions(next_billing_date);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_subscriptions_updated_at();

-- Constraint: Only one active/trial subscription per user at a time
-- (grace_period and cancelled don't count towards this)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_active
ON public.subscriptions(user_id, status)
WHERE status IN ('active', 'trial');

COMMENT ON TABLE public.subscriptions IS 'Manages subscription state machine for premium users including trial period, billing cycles, and grace periods';
COMMENT ON COLUMN public.subscriptions.status IS 'Current subscription status: active (paid), cancelled (pending downgrade), grace_period (payment failed, retrying), trial (14-day free)';
COMMENT ON COLUMN public.subscriptions.payment_retry_count IS 'Number of times payment has been retried during grace period (max 3 per spec)';
