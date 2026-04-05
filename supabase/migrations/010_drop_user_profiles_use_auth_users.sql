-- Migration: 010_drop_user_profiles_use_auth_users.sql
-- Purpose: Remove the user_profiles table and re-anchor subscriptions directly to auth.users.
--          All existing records are test data (project not yet released); no backfill is needed.
--
-- ⚠  SAFETY NOTE: This migration irreversibly drops user_profiles and all its data.
--    It is safe to run only when there are no real user accounts in the database.
--    If this migration is ever applied to a production database that has real user data,
--    pause here and run a data export / backfill script first.
--
-- Changes:
--   1. Drop the subscriptions→user_profiles FK, re-add it referencing auth.users(id).
--   2. Expand the subscriptions.status check constraint to include statuses used by the
--      Paddle webhook handler (cancelled_pending, past_due) and the grace-period expiry
--      flow (downgraded).
--   3. Drop user_profiles table and associated triggers/functions.

-- ─── 1. Re-anchor subscriptions.user_id to auth.users ───────────────────────

ALTER TABLE public.subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;

ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── 2. Expand subscriptions.status check constraint ────────────────────────

ALTER TABLE public.subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN (
        'active',
        'trial',
        'cancelled',
        'cancelled_pending',
        'grace_period',
        'past_due',
        'downgraded'
    ));

-- ─── 3. Drop user_profiles and its supporting objects ───────────────────────

-- Drop the trigger that auto-created a profile on auth.users INSERT
DROP TRIGGER IF EXISTS trigger_auth_user_created ON auth.users;

-- Drop the supporting functions
DROP FUNCTION IF EXISTS public.on_auth_user_created() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_profiles_updated_at() CASCADE;

-- Drop the table (CASCADE removes dependent objects such as indexes and policies)
DROP TABLE IF EXISTS public.user_profiles CASCADE;
