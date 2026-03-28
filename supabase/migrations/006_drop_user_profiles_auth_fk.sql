-- Migration: 006_drop_user_profiles_auth_fk.sql
-- Purpose: Remove the foreign key constraint from user_profiles.id to auth.users.id.
--          WAReminder uses Google OAuth directly (not Supabase Auth), so user_profiles
--          rows are created independently without corresponding auth.users rows.

ALTER TABLE public.user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
