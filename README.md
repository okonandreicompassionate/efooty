# eTournament: Esports Tournament & Bracketing Platform

eTournament is a production-ready esports tournament platform featuring tournament hosting, registration flows, automatic matchmaking brackets, score submissions, leaderboards, player statistics, notifications, direct messages, and achievements.

The backend is designed to integrate with Supabase Auth, Database, Storage, and Row-Level Security policies.

---

## Quick Start

eTournament uses Supabase for live production data. After configuring Supabase, you can host tournaments, approve players, generate brackets, submit scorecards, manage friend challenges, and message other players.

---

## Production Setup: Connecting Supabase

Follow these steps to connect your own Supabase project.

### Step 1: Create a Supabase Project

1. Go to the [Supabase Dashboard](https://database.new) and create a new project.
2. Choose your project name, database password, and preferred region.

### Step 2: Run the SQL Schema

1. Open your project and navigate to the SQL Editor.
2. Click New Query.
3. Open `/supabase/schema.sql` from this codebase.
4. Copy the full contents of `schema.sql` and paste it into the Supabase SQL Editor.
5. Click Run.

This creates tables, indexes, constraints, RLS policies, profile triggers, and storage bucket setup.

### Step 3: Create Storage Buckets

If your Supabase SQL permissions do not automatically create storage buckets, create these public buckets manually:

- `avatars`
- `tournament-banners`
- `proof-screenshots`

### Step 4: Configure Environment Variables

Create `.env.local` in the project root and add:

```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-public-key"
```

Then run:

```bash
npm install
npm run dev
```

---

## Architecture

```txt
README.md                Setup guide and project overview
index.html               Entry DOM page
metadata.json            Application metadata
package.json             Scripts and dependencies
supabase/schema.sql      SQL schemas, triggers, and RLS policies
src/types.ts             TypeScript data contracts
src/main.tsx             DOM mounting and global safeguards
src/index.css            Global Tailwind CSS and theme layer
src/supabase.ts          Supabase SDK initializer
src/App.tsx              Auth gates and screen routing
src/services/db.ts       Data access layer
src/components           Dashboard, tournaments, chat, settings, and organizer screens
```

## Row Level Security Policies

- Profiles: anyone can read player profiles; owners can edit their own profiles.
- Tournaments: publicly readable; admins and organizers can write or edit.
- Tournament players: publicly readable; users can register themselves; admins and organizers can update registration statuses.
- Matches: publicly readable; admins and organizers can write or edit match scores and statuses.
- Match results: publicly readable; match participants can submit scores; admins and organizers can approve them.
- Notifications: users can only see and mark read their own notifications.
- Settings: only owners can read and edit settings.
