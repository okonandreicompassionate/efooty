-- Migration: add allow_dms to settings (idempotent)
-- Run this on your Supabase/Postgres instance to ensure the column exists.

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS allow_dms boolean NOT NULL DEFAULT true;

-- No further changes required; default value ensures existing rows accept DMs.
