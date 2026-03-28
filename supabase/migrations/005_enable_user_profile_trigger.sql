-- Migration: 005_enable_user_profile_trigger.sql
-- Purpose: Activate the auto-create user_profiles trigger on signup,
--          and backfill profiles for existing auth.users who don't have one.

-- Activate the trigger (was commented out in 001)
CREATE TRIGGER trigger_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.on_auth_user_created();

-- Backfill profiles for any existing users who signed up before this migration
INSERT INTO public.user_profiles (id, email, plan_type)
SELECT
    u.id,
    u.email,
    'free'
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND u.email IS NOT NULL;
