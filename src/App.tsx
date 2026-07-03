"use client";

import { useState, useEffect } from 'react';
import { 
  Trophy, Shield, Mail, Lock, Sparkles, LogIn, 
  Gamepad2, Info, CheckCircle2, ChevronRight 
} from 'lucide-react';
import { Profile, Tournament, Game, Notification } from './types';
import { db, ensureDbSeeded } from './services/db';
import { isSupabaseConfigured, getSupabaseConfig, supabase } from './supabase';
import Navbar from './components/Navbar';
import { useToast } from './components/Toast';
import DashboardView from './components/DashboardView';
import TournamentsView from './components/TournamentsView';
import EmbedView from './components/EmbedView';
import LeaderboardView from './components/LeaderboardView';
import AchievementsView from './components/AchievementsView';
import OrganizerView from './components/OrganizerView';
import SettingsView from './components/SettingsView';
import MessagesView from './components/MessagesView';
import FriendsView from './components/FriendsView';
import FriendlyMatchesView from './components/FriendlyMatchesView';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const toast = useToast();
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState<string | null>(null);

  // App States
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadDmCount, setUnreadDmCount] = useState(0);
  const [pendingFriendChallengesCount, setPendingFriendChallengesCount] = useState(0);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [embedTournamentId, setEmbedTournamentId] = useState<string | null>(null);
  const [appDataError, setAppDataError] = useState<string | null>(null);

  // Refresh helper
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Listen to Auth state changes
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsAuthLoading(false);
      return;
    }

    const initializeAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('[App] Failed to get current Supabase session:', sessionError);
        }

        if (session?.user) {
          await ensureDbSeeded();
          const profile = await db.getCurrentUser();
          setCurrentUser(profile);
        }
      } catch (err) {
        console.error('[App] Error while initializing auth:', err);
      } finally {
        setIsAuthLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          try {
            await ensureDbSeeded();
            const profile = await db.getCurrentUser();
            setCurrentUser(profile);
          } catch (err) {
            console.error('Failed to get profile:', err);
          }
        } else {
          setCurrentUser(null);
        }
        setIsAuthLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle embed route support without regular page navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname.split('/').filter(Boolean);
    if (path[0] === 'embed' && path[1] === 'tournament' && path[2]) {
      setEmbedTournamentId(path[2]);
      return;
    }

    if (!tournaments.length) return;

    try {
      const params = new URLSearchParams(window.location.search);
      const tournamentParam = params.get('tournament') || params.get('t');
      if (tournamentParam && tournaments.some(t => t.id === tournamentParam)) {
        setSelectedTournamentId(tournamentParam);
        setActiveTab('tournaments');
      }
    } catch (err) {
      console.warn('Unable to parse tournament deep link from URL.', err);
    }
  }, [tournaments]);

  // Fetch application data
  useEffect(() => {
    if (!currentUser) return;
    const userId = currentUser.id;

    async function loadAppData() {
      try {
        setAppDataError(null);
        await ensureDbSeeded();
        const results = await Promise.allSettled([
          db.getTournaments(),
          db.getGames(),
          db.getProfiles(),
          db.getNotifications(userId),
          db.getUnreadDmCount(userId),
          db.getFriendChallenges()
        ]);

        const [tournamentsResult, gamesResult, profilesResult, notificationsResult, unreadDmResult, friendChallengesResult] = results;
        const failedResults = results.filter(result => result.status === 'rejected') as PromiseRejectedResult[];

        if (failedResults.length) {
          console.error('Some app data failed to load:', failedResults.map(result => result.reason));
          setAppDataError("Couldn't load some live data right now. Please refresh.");
        }

        const tournamentsData = tournamentsResult.status === 'fulfilled' ? tournamentsResult.value : tournaments;
        const gamesData = gamesResult.status === 'fulfilled' ? gamesResult.value : games;
        const profilesData = profilesResult.status === 'fulfilled' ? profilesResult.value : profiles;
        const notificationsData = notificationsResult.status === 'fulfilled' ? notificationsResult.value : notifications;
        const unreadDmData = unreadDmResult.status === 'fulfilled' ? unreadDmResult.value : unreadDmCount;
        const friendChallengesData = friendChallengesResult.status === 'fulfilled' ? friendChallengesResult.value : [];
        const pendingFriendCount = friendChallengesData.filter((challenge) => challenge.status === 'pending' && challenge.opponent_id === userId).length;

        console.info('[App] Loaded app data', {
          tournaments: tournamentsData.length,
          games: gamesData.length,
          profiles: profilesData.length,
          notifications: notificationsData.length,
          pendingFriendChallenges: pendingFriendCount
        });

        if (gamesData.length === 0) {
          console.warn('[App] No games were returned from the database; the host form will use the fallback seeded options.');
        }

        setTournaments(tournamentsData);
        setGames(gamesData);
        setProfiles(profilesData);
        setNotifications(notificationsData);
        setUnreadDmCount(unreadDmData);
        setPendingFriendChallengesCount(pendingFriendCount);
      } catch (err) {
        console.error('Error loading app data:', err);
        setAppDataError("Couldn't load live data right now. Please refresh.");
      }
    }
    loadAppData();
  }, [currentUser, refreshTrigger]);

  const handleRefreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Real Supabase Auth submission
  const handleAuthSubmit = async (e: any) => {
    e.preventDefault();
    setAuthError(null);

    if (!isSupabaseConfigured || !supabase) {
      setAuthError('The app is not fully configured yet.');
      return;
    }

    if (!authEmail.trim() || !authPassword.trim() || (authMode === 'signup' && !authUsername.trim())) {
      setAuthError("Please fill in all required fields.");
      return;
    }

    try {
      if (authMode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) {
          if (error.message.toLowerCase().includes('invalid login credentials')) {
            throw new Error("Invalid email or password. If you don't have an account, switch to 'Sign Up' above.");
          }
          throw error;
        }
        
        if (data.user) {
          await ensureDbSeeded();
          const profile = await db.getCurrentUser();
          setCurrentUser(profile);
          handleRefreshData();
        }
      } else {
        const username = authUsername.trim().replace(/\s+/g, '_').toLowerCase();
        if (username.length < 3) {
          setAuthError('Choose a username with at least 3 characters.');
          return;
        }

        const isAvailable = await db.isUsernameAvailable(username);
        if (!isAvailable) {
          setAuthError('That username is already taken. Try another one.');
          return;
        }

        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              username,
              role: 'player'
            }
          }
        });
        if (error) throw error;
        
        if (data.user) {
          toast.show("Registration successful! If your Supabase project requires email confirmation, please check your inbox to confirm.", 'success');
          setAuthMode('signin');
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setAuthError('Authentication failed. Please check your details and try again.');
    }
  };

  if (isAuthLoading) {
    return (
      <div className="et-light min-h-screen bg-[#F5F6F8] text-gray-950 flex flex-col items-center justify-center p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-600 text-white font-extrabold animate-bounce mb-4 shadow-sm">
          <Trophy className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-700">Loading eTournament...</p>
      </div>
    );
  }

  // FORCE SUPABASE CONFIGURATION IN LIVE MODE
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-slate-100 text-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_24%)]" />

        <div className="relative z-10 w-full max-w-lg space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 to-sky-300 text-slate-950 shadow-[0_24px_80px_rgba(56,189,248,0.18)]">
              <Info className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Database connection required
              </h1>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">eTournament live mode</p>
            </div>
          </div>

          <div className="rounded-4xl border border-slate-200/70 bg-white shadow-xl p-6 sm:p-8 space-y-6">
            <p className="text-sm text-slate-700 leading-relaxed">
              This app is in <strong className="text-slate-950">Live Mode</strong> and requires a configured <strong className="text-cyan-600">Supabase database</strong>. Offline simulation is disabled.
            </p>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-[0.18em] border-b border-slate-200 pb-2">Configuration Steps</h3>
              
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-cyan-700 font-semibold">1</div>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">Create a Supabase Project</p>
                    <p className="text-slate-500">Open the <a href="https://database.new" target="_blank" rel="noreferrer" className="text-cyan-600 hover:underline">Supabase Dashboard</a> and start a new project.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-cyan-700 font-semibold">2</div>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">Apply the database schema</p>
                    <p className="text-slate-500">Run the SQL from <code className="rounded-xl bg-slate-100 px-2 py-1 text-xs text-cyan-700">/supabase/schema.sql</code>.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-cyan-700 font-semibold">3</div>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">Set environment variables</p>
                    <p className="text-slate-500">Create a <code className="rounded-xl bg-slate-100 px-2 py-1 text-xs text-cyan-700">.env</code> file with your Supabase values.</p>
                  </div>
                </div>
              </div>
            </div>

            <pre className="mt-2 overflow-x-auto rounded-3xl border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-700 font-mono">
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
            </pre>

            <p className="text-[11px] text-slate-500">Restart your dev server after updating <code className="rounded-xl bg-slate-100 px-2 py-1 text-xs text-cyan-700">.env</code>.</p>
          </div>
        </div>
      </div>
    );
  }

  // RENDER LOGIN SCREEN
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-white text-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_22%)]" />

        <div className="relative z-10 w-full max-w-md space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 to-sky-300 text-slate-950 font-black shadow-[0_24px_80px_rgba(56,189,248,0.18)]">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                eTournament
              </h1>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Competitive tournament platform</p>
            </div>
          </div>

          <div className="rounded-4xl border border-slate-200 bg-white shadow-xl p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
              <button 
                type="button"
                onClick={() => { setAuthMode('signin'); setAuthError(null); }}
                className={`rounded-2xl py-2 text-xs font-semibold transition ${
                  authMode === 'signin' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button 
                type="button"
                onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                className={`rounded-2xl py-2 text-xs font-semibold transition ${
                  authMode === 'signup' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.2em]">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="email" 
                    placeholder="e.g. okon@etournament.gg" 
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-3xl pl-11 pr-4 py-3 text-sm text-slate-950 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
              </div>

              {authMode === 'signup' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.2em]">Username</label>
                  <div className="relative">
                    <Gamepad2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="e.g. clutch_king" 
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-3xl pl-11 pr-4 py-3 text-sm text-slate-950 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.2em]">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-3xl pl-11 pr-4 py-3 text-sm text-slate-950 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
              </div>

              {authError && (
                <p className="text-sm text-red-600 font-semibold bg-red-50 border border-red-200 px-4 py-3 rounded-3xl">
                  ⚠️ {authError}
                </p>
              )}

              <button 
                type="submit"
                className="w-full rounded-3xl bg-gradient-to-r from-cyan-500 to-sky-500 px-5 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-slate-950 shadow-[0_8px_32px_rgba(56,189,248,0.18)] transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-center gap-2">
                  <LogIn className="h-4 w-4" />
                  {authMode === 'signin' ? 'Sign in securely' : 'Create account'}
                </div>
              </button>
            </form>

          </div>

        </div>
      </div>
    );
  }

  if (embedTournamentId) {
    return <EmbedView tournamentId={embedTournamentId} />;
  }

  // RENDER AUTHENTICATED PLATFORM MAIN DASHBOARD
  return (
    <div className="min-h-screen bg-[#f8fbff] text-slate-950 flex flex-col font-sans pb-[calc(5.5rem+env(safe-area-inset-bottom))] relative overflow-x-hidden">
      
      {/* Immersive background blurs */}
      <div className="absolute top-0 right-0 w-130 h-130 bg-cyan-200/70 blur-[140px] -z-10 rounded-full" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-100/80 blur-[110px] -z-10 rounded-full" />

      {/* Dynamic Navbar */}
      <Navbar 
        currentUser={currentUser} 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          // Clear deep links
          if (tab !== 'tournaments') {
            setSelectedTournamentId(null);
          }
        }}
        notifications={notifications}
        unreadDmCount={unreadDmCount}
        pendingFriendChallengesCount={pendingFriendChallengesCount}
        onRefreshNotifications={handleRefreshData}
      />

      {/* Main page stage */}
      <main className="flex-1 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 w-full relative z-10">
        {appDataError && (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {appDataError}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <ErrorBoundary label="Dashboard">
            <DashboardView 
              currentUser={currentUser} 
              tournaments={tournaments} 
              games={games} 
              setActiveTab={setActiveTab}
              setSelectedTournamentId={setSelectedTournamentId}
              onRefreshApp={handleRefreshData}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'tournaments' && (
          <ErrorBoundary label="Tournaments">
            <TournamentsView 
              currentUser={currentUser} 
              tournaments={tournaments} 
              games={games} 
              profiles={profiles}
              onRefreshTournaments={handleRefreshData}
              selectedTournamentId={selectedTournamentId}
              setSelectedTournamentId={setSelectedTournamentId}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'leaderboard' && (
          <ErrorBoundary label="Leaderboard">
            <LeaderboardView games={games} tournaments={tournaments} />
          </ErrorBoundary>
        )}

        {activeTab === 'achievements' && (
          <ErrorBoundary label="Achievements">
            <AchievementsView currentUserId={currentUser?.id ?? ''} />
          </ErrorBoundary>
        )}

        {activeTab === 'messages' && (
          <ErrorBoundary label="Messages">
            <MessagesView currentUser={currentUser} profiles={profiles} />
          </ErrorBoundary>
        )}

        {activeTab === 'friends' && (
          <ErrorBoundary label="Friends">
            <FriendsView currentUser={currentUser} profiles={profiles} setActiveTab={setActiveTab} />
          </ErrorBoundary>
        )}

        {activeTab === 'friendly' && (
          <ErrorBoundary label="Friendly matches">
            <FriendlyMatchesView currentUser={currentUser} profiles={profiles} games={games} setActiveTab={setActiveTab} onRefreshApp={handleRefreshData} />
          </ErrorBoundary>
        )}

        {activeTab === 'organizer' && (
          <ErrorBoundary label="Organizer">
            <OrganizerView 
              currentUser={currentUser} 
              tournaments={tournaments} 
              profiles={profiles}
              setActiveTab={setActiveTab}
              setSelectedTournamentId={setSelectedTournamentId}
              onRefreshTournaments={handleRefreshData}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'settings' && (
          <ErrorBoundary label="Settings">
            <SettingsView 
              currentUser={currentUser} 
              onRefreshProfile={handleRefreshData} 
            />
          </ErrorBoundary>
        )}
      </main>

    </div>
  );
}
