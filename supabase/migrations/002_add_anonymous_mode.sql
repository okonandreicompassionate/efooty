-- Migration: add anonymous_mode to settings (idempotent)
-- Run this on your Supabase/Postgres instance to ensure the column exists.

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS anonymous_mode boolean NOT NULL DEFAULT false;
