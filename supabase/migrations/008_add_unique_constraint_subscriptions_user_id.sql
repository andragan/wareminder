-- Migration: 008_add_unique_constraint_subscriptions_user_id.sql
-- Purpose: Add unique constraint on user_id so upsert(onConflict: 'user_id') works.
-- One user can only have one subscription record; conflicts are updated in place.

ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);
