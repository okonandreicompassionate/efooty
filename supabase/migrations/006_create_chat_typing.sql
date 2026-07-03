-- Migration: create chat_typing table (idempotent)
CREATE TABLE IF NOT EXISTS public.chat_typing (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id text not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  last_typing_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(channel_id, user_id)
);
