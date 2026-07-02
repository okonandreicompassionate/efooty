-- Run this in Supabase SQL Editor to fix bracket generation 403 errors.
-- It replaces the matches policies with explicit insert/update/delete checks.

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
