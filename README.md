# 🏆 KickOff: Esports Tournament & Bracketing Platform

KickOff is a production-ready, premium esports tournament platform featuring dynamic tournament hosting, registration flows, automatic matchmaking brackets (single-elimination), real-time score submissions, leaderboards, player statistics, notifications, and modular achievements.

The backend is fully designed to integrate with **Supabase** (Auth, Database, Storage, and Row-Level Security Policies).

---

## ⚡ Quick Start: Zero-Config Sandbox Mode

KickOff features a **dual-mode database adapter**. 
- If Supabase is **not yet configured**, the app automatically falls back to a high-fidelity **LocalStorage Simulation Engine** pre-seeded with **20 players, 5 organizers, 10 tournaments, matches, and achievements**.
- You can fully interact with the platform, host tournaments, approve players, generate brackets, and submit scorecards instantly inside the live preview.
- Use the **Sandbox Role Hot-Swap** widget at the bottom right of the screen to switch between **Admin**, **Organizer**, and **Player** accounts instantly to verify permissions.

---

## ⚙️ Production Setup: Connecting Your Supabase Backend

Follow these 4 simple steps to connect your own Supabase project:

### Step 1: Create a Supabase Project
1. Go to the [Supabase Dashboard](https://database.new) and create a new project.
2. Choose your project name (e.g., `KickOff Arena`), database password, and preferred region.

### Step 2: Run the SQL Schema
1. Open your newly created project and navigate to the **SQL Editor** in the left sidebar.
2. Click **New Query**.
3. Open the file `/supabase/schema.sql` from this codebase.
4. Copy the entire contents of `schema.sql` and paste it into the Supabase SQL Editor.
5. Click **Run**.
*(This will automatically create all tables, indexes, constraints, row-level security (RLS) policies, automatic profile creation triggers, and configure the storage buckets).*

### Step 3: Create Storage Buckets (if not auto-created via SQL)
If your Supabase SQL permissions didn't automatically instantiate the storage buckets, create them manually:
1. Navigate to **Storage** in the Supabase sidebar.
2. Create 3 **Public** buckets:
   - `avatars`
   - `tournament-banners`
   - `proof-screenshots`

### Step 4: Configure Environment Variables
1. Create a file named `.env` in the root of your project (or copy `.env.example`).
2. Add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-public-key"
   ```
3. Run the development server:
   ```bash
   npm install
   npm run dev
   ```

---

## 🏗️ Architecture & Features

```
├── README.md               # Setup Guide and project breakdown
├── index.html              # Entry DOM page
├── metadata.json           # Application settings
├── package.json            # Script dependencies
├── supabase/
│   └── schema.sql          # Complete SQL schemas, triggers, & RLS policies
└── src/
    ├── types.ts            # Absolute strictly typed TypeScript interface files
    ├── main.tsx            # DOM mounting
    ├── index.css           # Global Tailwind CSS custom styles
    ├── supabase.ts         # Supabase SDK Initializer
    ├── App.tsx             # Master router, auth gates & screen routing
    ├── services/
    │   └── db.ts           # Dual-mode queries (Live Supabase vs LocalStorage)
    └── components/
        ├── Navbar.tsx      # Notification trays, active tabs, profile menus
        ├── BracketTree.tsx # SVG single-elimination connectors and score cards
        ├── RoleSwitcher.tsx# Hot-swap simulator for rapid trial testing
        ├── DashboardView.tsx# Stats counts, win-rate charts, bento blocks
        ├── TournamentsView.tsx# Lifecycles, details overview, matches, scorecard submissions
        ├── LeaderboardView.tsx# Game filtered PTS charts
        ├── AchievementsView.tsx# Gamification XP levels, badges
        ├── OrganizerView.tsx# Registrations screenings, score overrides
        └── SettingsView.tsx# User bios, email and browser alerts configurations
```

### 🔐 Row Level Security (RLS) Policies Implemented:
- **Profiles**: Anyone can read player profiles. Only owners can edit their own profiles.
- **Tournaments**: Publicly readable. Only Admins/Organizers can write or edit tournaments.
- **Tournament Players**: Publicly readable. Users can register/de-register themselves. Only Admins/Organizers can update registration statuses (Approve/Reject).
- **Matches**: Publicly readable. Only Admins/Organizers can write or edit match scores and statuses.
- **Match Results**: Publicly readable. Match participants can submit scores. Admins/Organizers can approve them.
- **Notifications**: Users can only see and mark read their own notifications.
- **Settings**: Only owners can read and edit settings.
