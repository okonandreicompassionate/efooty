-- Migration: add show_email to settings (idempotent)
-- Run this on your Supabase/Postgres instance to ensure the column exists.

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS show_email boolean NOT NULL DEFAULT false;
