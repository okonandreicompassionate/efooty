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
import DashboardView from './components/DashboardView';
import TournamentsView from './components/TournamentsView';
import LeaderboardView from './components/LeaderboardView';
import AchievementsView from './components/AchievementsView';
import OrganizerView from './components/OrganizerView';
import SettingsView from './components/SettingsView';
import MessagesView from './components/MessagesView';
import FriendsView from './components/FriendsView';
import FriendlyMatchesView from './components/FriendlyMatchesView';

export default function App() {
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

  // Fetch application data
  useEffect(() => {
    if (!currentUser) return;

    async function loadAppData() {
      try {
        setAppDataError(null);
        await ensureDbSeeded();
        const results = await Promise.allSettled([
          db.getTournaments(),
          db.getGames(),
          db.getProfiles(),
          db.getNotifications(currentUser.id),
          db.getUnreadDmCount(currentUser.id),
          db.getFriendChallenges()
        ]);

        const [tournamentsResult, gamesResult, profilesResult, notificationsResult, unreadDmResult, friendChallengesResult] = results;
        const failedResults = results.filter(result => result.status === 'rejected') as PromiseRejectedResult[];

        if (failedResults.length) {
          console.error('Some app data failed to load:', failedResults.map(result => result.reason));
          setAppDataError('Some live data could not be loaded. Check your Supabase schema and refresh.');
        }

        const tournamentsData = tournamentsResult.status === 'fulfilled' ? tournamentsResult.value : tournaments;
        const gamesData = gamesResult.status === 'fulfilled' ? gamesResult.value : games;
        const profilesData = profilesResult.status === 'fulfilled' ? profilesResult.value : profiles;
        const notificationsData = notificationsResult.status === 'fulfilled' ? notificationsResult.value : notifications;
        const unreadDmData = unreadDmResult.status === 'fulfilled' ? unreadDmResult.value : unreadDmCount;
        const friendChallengesData = friendChallengesResult.status === 'fulfilled' ? friendChallengesResult.value : [];
        const pendingFriendCount = friendChallengesData.filter((challenge) => challenge.status === 'pending' && challenge.opponent_id === currentUser.id).length;

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
        setAppDataError('Live data failed to load. Check your Supabase connection and refresh.');
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
      setAuthError("Supabase environment variables are missing. Please use Sandbox quick login!");
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
          alert("Registration successful! If your Supabase project requires email confirmation, please check your inbox to confirm. Otherwise, you can sign in directly now!");
          setAuthMode('signin');
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setAuthError(err.message || "An authentication error occurred.");
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.16),transparent_34%),#05070b] text-zinc-100 flex flex-col items-center justify-center p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-black font-extrabold animate-bounce mb-4 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
          <Trophy className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Loading KickOff Arena...</p>
      </div>
    );
  }

  // FORCE SUPABASE CONFIGURATION IN LIVE MODE
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#050505] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Glow effect backdrops */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-red-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />

        <div className="w-full max-w-lg space-y-6 relative z-10">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-red-600 text-black font-black shadow-[0_0_30px_rgba(245,158,11,0.25)]">
              <Info className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight text-white uppercase">
                Database Connection <span className="text-amber-400">Required</span>
              </h1>
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest">KickOff Arena Live Mode</p>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-zinc-950/60 p-6 sm:p-8 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl space-y-6 text-left">
            <p className="text-xs text-zinc-300 leading-relaxed">
              This application has been set to <strong>Live Mode</strong> and requires a connected <strong>Supabase Database</strong>. Offline LocalStorage simulation is disabled.
            </p>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">Configuration Steps</h3>
              
              <div className="space-y-3 text-xs">
                <div className="flex gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 font-bold">1</div>
                  <div className="text-zinc-400">
                    <p className="font-semibold text-zinc-200">Create a Supabase Project</p>
                    <p className="mt-0.5">Go to the <a href="https://database.new" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">Supabase Dashboard</a> and start a new project.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 font-bold">2</div>
                  <div className="text-zinc-400">
                    <p className="font-semibold text-zinc-200">Run the Database Schema</p>
                    <p className="mt-0.5">Copy the entire query from <code className="text-zinc-200 bg-white/5 px-1 py-0.5 rounded">/supabase/schema.sql</code> and execute it in your Supabase SQL Editor.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 font-bold">3</div>
                  <div className="text-zinc-400">
                    <p className="font-semibold text-zinc-200">Set Environment Variables</p>
                    <p className="mt-0.5">Create a <code className="text-zinc-200 bg-white/5 px-1 py-0.5 rounded">.env</code> file in the project root and add your project variables:</p>
                    <pre className="mt-2 p-3 bg-black/40 rounded-xl text-[10px] text-amber-300 font-mono border border-white/5 overflow-x-auto">
{`VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"`}
                    </pre>
                    <p className="text-[10px] text-zinc-400 mt-2">
                      Use a <code className="text-zinc-200 bg-white/5 px-1 py-0.5 rounded">.env.local</code> file at the project root and restart the dev server.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center pt-2">
              <p className="text-[10px] text-zinc-500">Restart your development server after configuring the environment variables.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RENDER LOGIN SCREEN
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#050505] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        
        {/* Glow effect backdrops */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 h-96 w-96 rounded-full bg-indigo-500/5 blur-3xl" />

        <div className="w-full max-w-md space-y-6 relative z-10">
          
          {/* Logo Heading */}
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-black font-black shadow-[0_0_30px_rgba(6,182,212,0.35)]">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight text-white uppercase">
                KICK<span className="text-cyan-400">OFF</span>
              </h1>
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest">Esports Tournament Arena</p>
            </div>
          </div>

          {/* Login Credentials Box */}
          <div className="rounded-[32px] border border-white/10 bg-zinc-950/60 p-6 sm:p-8 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl space-y-6">
            
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl">
              <button 
                type="button"
                onClick={() => { setAuthMode('signin'); setAuthError(null); }}
                className={`py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  authMode === 'signin' ? 'bg-cyan-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button 
                type="button"
                onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                className={`py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  authMode === 'signup' ? 'bg-cyan-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Real Supabase Auth form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input 
                    type="email" 
                    placeholder="e.g. okon@kickoff.gg" 
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              {authMode === 'signup' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">Username</label>
                  <div className="relative">
                    <Gamepad2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="e.g. clutch_king" 
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              {authError && (
                <p className="text-[10px] text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">
                  ⚠️ {authError}
                </p>
              )}

              <button 
                type="submit"
                className="w-full py-2.5 bg-linear-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_4px_20px_rgba(6,182,212,0.15)]"
              >
                <LogIn className="h-4 w-4" />
                {authMode === 'signin' ? 'Authenticate via Supabase' : 'Create Supabase Account'}
              </button>
            </form>

          </div>

        </div>
      </div>
    );
  }

  // RENDER AUTHENTICATED PLATFORM MAIN DASHBOARD
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.16),transparent_34%),#05070b] text-zinc-100 flex flex-col font-sans pb-28 relative overflow-hidden">
      
      {/* Immersive background blurs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-600/10 blur-[120px] -z-10 rounded-full" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-600/10 blur-[100px] -z-10 rounded-full" />

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
          <DashboardView 
            currentUser={currentUser} 
            tournaments={tournaments} 
            games={games} 
            setActiveTab={setActiveTab}
            setSelectedTournamentId={setSelectedTournamentId}
          />
        )}

        {activeTab === 'tournaments' && (
          <TournamentsView 
            currentUser={currentUser} 
            tournaments={tournaments} 
            games={games} 
            profiles={profiles}
            onRefreshTournaments={handleRefreshData}
            selectedTournamentId={selectedTournamentId}
            setSelectedTournamentId={setSelectedTournamentId}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView games={games} tournaments={tournaments} />
        )}

        {activeTab === 'achievements' && (
          <AchievementsView currentUserId={currentUser.id} />
        )}

        {activeTab === 'messages' && (
          <MessagesView currentUser={currentUser} profiles={profiles} />
        )}

        {activeTab === 'friends' && (
          <FriendsView currentUser={currentUser} profiles={profiles} setActiveTab={setActiveTab} />
        )}

        {activeTab === 'friendly' && (
          <FriendlyMatchesView currentUser={currentUser} profiles={profiles} games={games} setActiveTab={setActiveTab} onRefreshApp={handleRefreshData} />
        )}

        {activeTab === 'organizer' && (
          <OrganizerView 
            currentUser={currentUser} 
            tournaments={tournaments} 
            profiles={profiles}
            setActiveTab={setActiveTab}
            setSelectedTournamentId={setSelectedTournamentId}
            onRefreshTournaments={handleRefreshData}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView 
            currentUser={currentUser} 
            onRefreshProfile={handleRefreshData} 
          />
        )}
      </main>

    </div>
  );
}
