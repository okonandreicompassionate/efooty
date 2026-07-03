-- Migration: create chat_reactions table (idempotent)
CREATE TABLE IF NOT EXISTS public.chat_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid references public.chats(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  emoji text not null,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);
