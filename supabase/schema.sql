-- ==========================================
-- KICKOFF: ESPORTS TOURNAMENT PLATFORM
-- COMPLETE SUPABASE SQL SCHEMA
-- ==========================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Clean existing tables (if any)
-- drop table if exists public.activity_logs cascade;
-- drop table if exists public.settings cascade;
-- drop table if exists public.player_statistics cascade;
-- drop table if exists public.leaderboards cascade;
-- drop table if exists public.achievements cascade;
-- drop table if exists public.notifications cascade;
-- drop table if exists public.match_results cascade;
-- drop table if exists public.matches cascade;
-- drop table if exists public.teams cascade;
-- drop table if exists public.tournament_players cascade;
-- drop table if exists public.tournaments cascade;
-- drop table if exists public.games cascade;
-- drop table if exists public.profiles cascade;

-- ==========================================
-- 1. PROFILES TABLE
-- ==========================================
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    username text unique not null,
    email text not null,
    avatar_url text,
    role text not null default 'player' check (role in ('admin', 'organizer', 'player')),
    bio text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 2. GAMES TABLE
-- ==========================================
create table public.games (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    slug text unique not null,
    icon text,
    cover_image text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 3. TOURNAMENTS TABLE
-- ==========================================
create table public.tournaments (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    description text,
    game_id uuid references public.games(id) on delete restrict not null,
    organizer_id uuid references public.profiles(id) on delete cascade not null,
    banner_url text,
    max_players integer not null default 16,
    status text not null default 'draft' check (status in ('draft', 'registration', 'active', 'completed')),
    start_time timestamp with time zone not null,
    format text not null default 'single_elimination' check (format in ('single_elimination', 'double_elimination', 'round_robin')),
    prize_pool text,
    rules text,
    winner_id uuid references public.profiles(id) on delete set null,
    entry_fee integer not null default 0,
    payment_provider text not null default 'none' check (payment_provider in ('none', 'paystack')),
    registration_note text,
    auto_lock_registration boolean not null default true,
    points_only boolean not null default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 4. TOURNAMENT PLAYERS (REGISTRATIONS)
-- ==========================================
create table public.tournament_players (
    id uuid default gen_random_uuid() primary key,
    tournament_id uuid references public.tournaments(id) on delete cascade not null,
    player_id uuid references public.profiles(id) on delete cascade not null,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    seed_no integer,
    display_name text,
    email text,
    region text,
    team_name text,
    notes text,
    paid boolean not null default false,
    payment_status text not null default 'free' check (payment_status in ('free', 'pending', 'paid')),
    payment_reference text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(tournament_id, player_id)
);

create or replace function public.enforce_tournament_capacity()
returns trigger as $$
declare
    approved_count integer;
    player_limit integer;
begin
    if new.status = 'approved' then
        select max_players into player_limit
        from public.tournaments
        where id = new.tournament_id;

        select count(*) into approved_count
        from public.tournament_players
        where tournament_id = new.tournament_id
          and status = 'approved'
          and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

        if approved_count >= player_limit then
            raise exception 'Tournament is full';
        end if;
    end if;

    return new;
end;
$$ language plpgsql;

create trigger enforce_tournament_capacity_before_write
    before insert or update on public.tournament_players
    for each row execute procedure public.enforce_tournament_capacity();

-- ==========================================
-- 5. TEAMS (Optional for team tournaments)
-- ==========================================
create table public.teams (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    logo_url text,
    captain_id uuid references public.profiles(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 6. MATCHES TABLE
-- ==========================================
create table public.matches (
    id uuid default gen_random_uuid() primary key,
    tournament_id uuid references public.tournaments(id) on delete cascade not null,
    round_no integer not null,
    match_no integer not null,
    player1_id uuid references public.profiles(id) on delete set null,
    player2_id uuid references public.profiles(id) on delete set null,
    player1_score integer default 0,
    player2_score integer default 0,
    winner_id uuid references public.profiles(id) on delete set null,
    status text not null default 'scheduled' check (status in ('scheduled', 'waiting', 'playing', 'disputed', 'completed')),
    next_match_id uuid references public.matches(id) on delete set null,
    scheduled_time timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 7. MATCH RESULTS (SUBMISSIONS)
-- ==========================================
create table public.match_results (
    id uuid default gen_random_uuid() primary key,
    match_id uuid references public.matches(id) on delete cascade not null,
    submitted_by uuid references public.profiles(id) on delete cascade not null,
    player1_score integer not null,
    player2_score integer not null,
    proof_url text,
    status text not null default 'pending' check (status in ('pending', 'approved', 'disputed')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(match_id, submitted_by)
);

-- ==========================================
-- 8. NOTIFICATIONS TABLE
-- ==========================================
create table public.notifications (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    title text not null,
    content text not null,
    link text,
    is_read boolean not null default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 9. ACHIEVEMENTS TABLE
-- ==========================================
create table public.achievements (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    description text not null,
    badge_icon text not null,
    xp_reward integer not null default 100,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User Achievements mapping
create table public.user_achievements (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    achievement_id uuid references public.achievements(id) on delete cascade not null,
    earned_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, achievement_id)
);

-- ==========================================
-- FRIEND CHALLENGES TABLE
-- ==========================================
create table public.friend_challenges (
    id uuid default gen_random_uuid() primary key,
    host_id uuid references public.profiles(id) on delete cascade not null,
    opponent_id uuid references public.profiles(id),
    opponent_name text,
    game_id uuid references public.games(id) on delete restrict not null,
    title text not null,
    status text not null default 'pending' check (status in ('pending', 'accepted', 'completed', 'flagged')),
    host_score integer,
    opponent_score integer,
    proof_url text,
    integrity_status text not null default 'pending' check (integrity_status in ('pending', 'verified', 'flagged')),
    verified_by uuid references public.profiles(id),
    points_awarded integer, 
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- FRIENDSHIPS TABLE
-- ==========================================
create table public.friendships (
    id uuid default gen_random_uuid() primary key,
    requester_id uuid references public.profiles(id) on delete cascade not null,
    addressee_id uuid references public.profiles(id) on delete cascade not null,
    status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    check (requester_id <> addressee_id),
    unique(requester_id, addressee_id)
);

-- ==========================================
-- 10. LEADERBOARDS TABLE
-- ==========================================
create table public.leaderboards (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    game_id uuid references public.games(id) on delete cascade not null,
    rank_points integer not null default 1000,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, game_id)
);

-- ==========================================
-- 11. PLAYER STATISTICS
-- ==========================================
create table public.player_statistics (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    game_id uuid references public.games(id) on delete cascade not null,
    matches_played integer not null default 0,
    matches_won integer not null default 0,
    matches_lost integer not null default 0,
    tournaments_played integer not null default 0,
    tournaments_won integer not null default 0,
    win_rate numeric(5,2) default 0.00,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, game_id)
);

-- ==========================================
-- 12. ACTIVITY LOGS
-- ==========================================
create table public.activity_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    action_type text not null,
    description text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 13. SETTINGS
-- ==========================================
create table public.settings (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade unique not null,
    push_notifications boolean not null default true,
    email_notifications boolean not null default true,
    public_profile boolean not null default true,
    dark_mode boolean not null default true,
    show_email boolean not null default false,
    allow_dms boolean not null default true,
    anonymous_mode boolean not null default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create policy "Allow owners to insert their own settings" on public.settings
    for insert with check (auth.uid()::uuid = user_id);

create policy "Allow owners to select and update their own settings" on public.settings
    for select, update using (auth.uid()::uuid = user_id);

create policy "Allow admins to delete settings" on public.settings
    for delete using (
        exists (
            select 1 from public.profiles
            where id = auth.uid()::uuid and role = 'admin'
        )
    );

-- ==========================================
-- AUTOMATIC PROFILE CREATION ON SIGNUP
-- ==========================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, email, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'role', 'player')
  );
  
  -- Create default player statistics for the first game if exists
  -- and default settings
  insert into public.settings (user_id) values (new.id);
  
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- AUTOMATIC STATS CALCULATION
-- ==========================================
create or replace function public.calculate_win_rate()
returns trigger as $$
begin
    if (new.matches_played > 0) then
        new.win_rate := (new.matches_won::numeric / new.matches_played::numeric) * 100;
    else
        new.win_rate := 0.00;
    end if;
    return new;
end;
$$ language plpgsql;

create trigger update_win_rate
    before insert or update on public.player_statistics
    for each row execute procedure public.calculate_win_rate();

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.match_results enable row level security;
alter table public.notifications enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.friendships enable row level security;
alter table public.leaderboards enable row level security;
alter table public.player_statistics enable row level security;
alter table public.activity_logs enable row level security;
alter table public.settings enable row level security;

-- PROFILES POLICIES
create policy "Allow public read on profiles" on public.profiles
    for select using (true);

create policy "Allow authenticated users to create their own profile" on public.profiles
    for insert with check (auth.uid()::uuid = id);

create policy "Allow owners to update their own profile" on public.profiles
    for update using (auth.uid()::uuid = id);

create policy "Allow admins to delete profiles" on public.profiles
    for delete using (
        exists (
            select 1 from public.profiles
            where id = auth.uid()::uuid and role = 'admin'
        )
    );

-- GAMES POLICIES
create policy "Allow public read on games" on public.games
    for select using (true);

create policy "Allow authenticated users to seed games" on public.games
    for insert with check (true);

create policy "Allow admins and organizers to manage games" on public.games
    for all using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role in ('admin', 'organizer')
        )
    );

-- TOURNAMENTS POLICIES
-- Drop existing tournament policies before creating fresh authoritative rules.
drop policy if exists "Allow public read on tournaments" on public.tournaments;
drop policy if exists "Allow authenticated users to create their own tournaments" on public.tournaments;
drop policy if exists "Allow tournament owners and admins to update tournaments" on public.tournaments;
drop policy if exists "Allow tournament owners and admins to delete tournaments" on public.tournaments;

create policy "Allow public read on tournaments" on public.tournaments
    for select using (true);

create policy "Allow authenticated users to create their own tournaments" on public.tournaments
    for insert with check (
        auth.uid()::uuid = organizer_id
    );

create policy "Allow tournament owners and admins to update tournaments" on public.tournaments
    for update using (
        auth.uid()::uuid = organizer_id or
        exists (
            select 1 from public.profiles
            where id = auth.uid()::uuid and role in ('admin', 'organizer')
        )
    );

create policy "Allow tournament owners and admins to delete tournaments" on public.tournaments
    for delete using (
        auth.uid()::uuid = organizer_id or
        exists (
            select 1 from public.profiles
            where id = auth.uid()::uuid and role in ('admin', 'organizer')
        )
    );

-- TOURNAMENT PLAYERS POLICIES
create policy "Allow public read on tournament registrations" on public.tournament_players
    for select using (true);

create policy "Allow players to register themselves" on public.tournament_players
    for insert with check (auth.uid() = player_id);

create policy "Allow players to cancel registration" on public.tournament_players
    for delete using (auth.uid() = player_id);

create policy "Allow organizers/admins to remove registrations" on public.tournament_players
    for delete using (
        exists (
            select 1 from public.tournaments t
            where t.id = tournament_id and t.organizer_id = auth.uid()::uuid
        ) or exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

create policy "Allow organizers/admins to manage registrations" on public.tournament_players
    for update using (
        exists (
            select 1 from public.tournaments t
            where t.id = tournament_id and t.organizer_id = auth.uid()::uuid
        ) or exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- TEAMS POLICIES
create policy "Allow public read on teams" on public.teams
    for select using (true);

create policy "Allow captains/organizers to manage teams" on public.teams
    for all using (
        auth.uid() = captain_id or 
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role in ('admin', 'organizer')
        )
    );

-- MATCHES POLICIES
drop policy if exists "Allow public read on matches" on public.matches;
drop policy if exists "Allow organizers/admins or tournament owners to manage matches" on public.matches;
drop policy if exists "Allow tournament hosts and admins to insert matches" on public.matches;
drop policy if exists "Allow tournament hosts and admins to update matches" on public.matches;
drop policy if exists "Allow tournament hosts and admins to delete matches" on public.matches;

create policy "Allow public read on matches" on public.matches
    for select using (true);

create policy "Allow tournament hosts and admins to insert matches" on public.matches
    for insert with check (
        exists (
            select 1 from public.tournaments t
            where t.id = public.matches.tournament_id
              and t.organizer_id = auth.uid()::uuid
        ) or exists (
            select 1 from public.profiles
            where id = auth.uid()::uuid and role = 'admin'
        )
    );

create policy "Allow tournament hosts and admins to update matches" on public.matches
    for update using (
        exists (
            select 1 from public.tournaments t
            where t.id = public.matches.tournament_id
              and t.organizer_id = auth.uid()::uuid
        ) or exists (
            select 1 from public.profiles
            where id = auth.uid()::uuid and role = 'admin'
        )
    ) with check (
        exists (
            select 1 from public.tournaments t
            where t.id = public.matches.tournament_id
              and t.organizer_id = auth.uid()::uuid
        ) or exists (
            select 1 from public.profiles
            where id = auth.uid()::uuid and role = 'admin'
        )
    );

create policy "Allow tournament hosts and admins to delete matches" on public.matches
    for delete using (
        exists (
            select 1 from public.tournaments t
            where t.id = public.matches.tournament_id
              and t.organizer_id = auth.uid()::uuid
        ) or exists (
            select 1 from public.profiles
            where id = auth.uid()::uuid and role = 'admin'
        )
    );

-- MATCH RESULTS POLICIES
create policy "Allow public read on match results" on public.match_results
    for select using (true);

create policy "Allow participants of the match to submit result" on public.match_results
    for insert with check (
        auth.uid() = submitted_by and
        exists (
            select 1 from public.matches m
            where m.id = match_id and (m.player1_id = auth.uid() or m.player2_id = auth.uid())
        )
    );

create policy "Allow organizers/admins to manage match results" on public.match_results
    for all using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role in ('admin', 'organizer')
        )
    );

-- NOTIFICATIONS POLICIES
create policy "Allow users to read their own notifications" on public.notifications
    for select using (auth.uid() = user_id);

create policy "Allow authenticated users to create notifications" on public.notifications
    for insert with check (auth.role() = 'authenticated' and auth.uid() is not null);

create policy "Allow users to update their own notifications" on public.notifications
    for update using (auth.uid() = user_id);

-- ACHIEVEMENTS POLICIES
create policy "Allow public read on achievements" on public.achievements
    for select using (true);

create policy "Allow authenticated users to insert achievements" on public.achievements
    for insert with check (
        auth.uid() is not null
    );

create policy "Allow public read on user achievements" on public.user_achievements
    for select using (true);

create policy "Allow authenticated users to insert user achievements" on public.user_achievements
    for insert with check (
        auth.uid()::uuid = user_id
    );

-- FRIEND CHALLENGES POLICIES
create policy "Allow public read on friend challenges" on public.friend_challenges
    for select using (true);

create policy "Allow authenticated users to create friend challenges" on public.friend_challenges
    for insert with check (
        auth.uid()::uuid = host_id
    );

create policy "Allow challenge participants to update friend challenges" on public.friend_challenges
    for update using (
        auth.uid()::uuid = host_id or auth.uid()::uuid = opponent_id
    );

-- FRIENDSHIPS POLICIES
create policy "Allow friendship participants to read" on public.friendships
    for select using (
        auth.uid()::uuid = requester_id or auth.uid()::uuid = addressee_id
    );

create policy "Allow users to create friendship requests" on public.friendships
    for insert with check (
        auth.role() = 'authenticated'
        and auth.uid() is not null
        and (
            auth.uid()::text = requester_id::text
            or auth.uid()::text = addressee_id::text
        )
    );

create policy "Allow friendship participants to update" on public.friendships
    for update using (
        auth.uid()::uuid = requester_id or auth.uid()::uuid = addressee_id
    );

create policy "Allow friendship participants to delete" on public.friendships
    for delete using (
        auth.uid()::uuid = requester_id or auth.uid()::uuid = addressee_id
    );

-- LEADERBOARDS POLICIES
create policy "Allow public read on leaderboards" on public.leaderboards
    for select using (true);

-- PLAYER STATISTICS POLICIES
create policy "Allow public read on player stats" on public.player_statistics
    for select using (true);

-- ACTIVITY LOGS POLICIES
create policy "Allow users to view their own activity logs" on public.activity_logs
    for select using (
        auth.uid() = user_id or
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

create policy "Allow system to insert activity logs" on public.activity_logs
    for insert with check (true);

-- SETTINGS POLICIES
create policy "Allow users to view and edit their own settings" on public.settings
    for all using (auth.uid() = user_id);

-- ==========================================
-- STORAGE BUCKETS SETUP
-- ==========================================
-- Supabase Storage is managed in the 'storage' schema. 
-- The following SQL creates the buckets and policies if they do not exist.
-- To execute this, make sure storage extensions are enabled.

insert into storage.buckets (id, name, public) 
values 
  ('avatars', 'avatars', true),
  ('tournament-banners', 'tournament-banners', true),
  ('proof-screenshots', 'proof-screenshots', true)
on conflict (id) do nothing;

-- Storage policies for avatars
create policy "Public Access to Avatars" on storage.objects 
    for select using (bucket_id = 'avatars');

create policy "Authenticated Users can upload avatars" on storage.objects 
    for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

create policy "Users can delete their own avatars" on storage.objects 
    for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for tournament-banners
create policy "Public Access to Banners" on storage.objects 
    for select using (bucket_id = 'tournament-banners');

create policy "Organizers can upload banners" on storage.objects 
    for insert with check (
        bucket_id = 'tournament-banners' and 
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and role in ('organizer', 'admin')
        )
    );

-- Storage policies for proof-screenshots
create policy "Public Access to Proofs" on storage.objects 
    for select using (bucket_id = 'proof-screenshots');

create policy "Players can upload proof" on storage.objects 
    for insert with check (bucket_id = 'proof-screenshots' and auth.role() = 'authenticated');

-- ==========================================
-- 14. CHATS TABLE
-- ==========================================
create table public.chats (
    id uuid default gen_random_uuid() primary key,
    tournament_id text not null, -- Can be 'global' or a tournament UUID
    user_id uuid references public.profiles(id) on delete cascade not null,
    username text not null,
    avatar_url text,
    content text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.chat_reads (
    id uuid default gen_random_uuid() primary key,
    channel_id text not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    last_read_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(channel_id, user_id)
);

alter table public.chats enable row level security;
alter table public.chat_reads enable row level security;

create policy "Allow public read on chats" on public.chats
    for select using (true);

create policy "Allow authenticated users to send chat messages" on public.chats
    for insert with check (auth.role() = 'authenticated' and auth.uid() = user_id);

create policy "Allow users to delete chat messages in their DMs or own messages" on public.chats
    for delete using (
        auth.role() = 'authenticated'
        and (
            user_id = auth.uid()::uuid
            or (
                tournament_id like 'dm:%'
                and auth.uid()::text in (
                    split_part(tournament_id, ':', 2),
                    split_part(tournament_id, ':', 3)
                )
            )
        )
    );

create policy "Allow users to read their own chat receipts" on public.chat_reads
    for select using (auth.uid()::uuid = user_id);

create policy "Allow users to update their own chat receipts" on public.chat_reads
    for insert with check (auth.uid()::uuid = user_id);

create policy "Allow users to edit their own chat receipts" on public.chat_reads
    for update using (auth.uid()::uuid = user_id);
