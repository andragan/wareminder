-- Migration: 003_create_payment_transactions.sql
-- Purpose: Create payment_transactions table to track billing history and failed payments
-- Created: 2026-02-27

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  
  -- Payment amount in cents (e.g., 999 = $9.99)
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'GBP')),
  
  -- Stripe reference
  stripe_charge_id TEXT UNIQUE,
  stripe_invoice_id TEXT,
  
  -- Payment status and result
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  failure_reason TEXT,
  
  -- Refund tracking
  refunded_amount_cents INTEGER DEFAULT 0,
  refund_date TIMESTAMP WITH TIME ZONE,
  refund_reason TEXT,
  
  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own transaction history
CREATE POLICY payment_transactions_select_own ON public.payment_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_payment_transactions_subscription_id ON public.payment_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_charge_id ON public.payment_transactions(stripe_charge_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_invoice_id ON public.payment_transactions(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON public.payment_transactions(created_at);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_payment_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payment_transactions_updated_at
BEFORE UPDATE ON public.payment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_payment_transactions_updated_at();

COMMENT ON TABLE public.payment_transactions IS 'Immutable record of all payment transactions for billing history, reconciliation, and dispute resolution';
COMMENT ON COLUMN public.payment_transactions.amount_cents IS 'Payment amount in cents to avoid floating-point precision issues';
COMMENT ON COLUMN public.payment_transactions.status IS 'Transaction status: pending (processing), success (charged), failed (declined), refunded (refund issued)';
COMMENT ON COLUMN public.payment_transactions.failure_reason IS 'Human-readable failure reason from Stripe for support/UX (e.g., card_declined, expired_card)';
