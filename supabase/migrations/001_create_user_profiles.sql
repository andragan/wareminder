-- Migration: 001_create_user_profiles.sql
-- Purpose: Create user_profiles table to store user account information and subscription plan type
-- Created: 2026-02-27

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'premium')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own profile
CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY user_profiles_update_own ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY user_profiles_insert_own ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_plan_type ON public.user_profiles(plan_type);

-- Trigger to automatically update updated_at on changes
CREATE OR REPLACE FUNCTION public.update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_user_profiles_updated_at();

-- Add custom claim to JWT for plan_type (if using Supabase Auth)
-- This allows accessing plan_type from JWT without additional queries
CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, plan_type)
  VALUES (NEW.id, NEW.email, 'free');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create trigger to auto-create profile when user signs up
-- Commented out as it depends on Supabase Auth configuration
-- CREATE TRIGGER trigger_auth_user_created
-- AFTER INSERT ON auth.users
-- FOR EACH ROW
-- EXECUTE FUNCTION public.on_auth_user_created();

COMMENT ON TABLE public.user_profiles IS 'Stores user profile information including subscription plan type';
COMMENT ON COLUMN public.user_profiles.plan_type IS 'User subscription plan: free or premium';
