"use client";

import { useState, useEffect } from 'react';
import { 
  Trophy, Shield, Mail, Lock, Sparkles, LogIn, 
  Gamepad2, Info, CheckCircle2, ChevronRight 
} from 'lucide-react';
import { Profile, Tournament, Game, Notification } from './types';
import { db, simulator } from './services/db';
import { isSupabaseConfigured, getSupabaseConfig, supabase } from './supabase';
import Navbar from './components/Navbar';
import RoleSwitcher from './components/RoleSwitcher';
import DashboardView from './components/DashboardView';
import TournamentsView from './components/TournamentsView';
import LeaderboardView from './components/LeaderboardView';
import AchievementsView from './components/AchievementsView';
import OrganizerView from './components/OrganizerView';
import SettingsView from './components/SettingsView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState<string | null>(null);

  // App States
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

  // Refresh helper
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Initial Auth Check
  useEffect(() => {
    async function checkAuth() {
      setIsAuthLoading(true);
      try {
        const user = await db.getCurrentUser();
        if (user) {
          setCurrentUser(user);
        }
      } catch (err) {
        console.error('Error on auth check:', err);
      } finally {
        setIsAuthLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Fetch application data
  useEffect(() => {
    if (!currentUser) return;

    async function loadAppData() {
      try {
        const [tournamentsData, gamesData, profilesData, notificationsData] = await Promise.all([
          db.getTournaments(),
          db.getGames(),
          db.getProfiles(),
          db.getNotifications(currentUser.id)
        ]);
        setTournaments(tournamentsData);
        setGames(gamesData);
        setProfiles(profilesData);
        setNotifications(notificationsData);
      } catch (err) {
        console.error('Error loading app data:', err);
      }
    }
    loadAppData();
  }, [currentUser, refreshTrigger]);

  const handleRefreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleRoleChange = async (role: any) => {
    if (!currentUser) return;
    const updated = await db.updateCurrentUserRole(role);
    setCurrentUser(updated);
    
    // Switch active tab if switching away from Organizer hub
    if (role === 'player' && activeTab === 'organizer') {
      setActiveTab('dashboard');
    }
    handleRefreshData();
  };

  const handleSandboxLogin = (profileId: string) => {
    const targetProfile = simulator.profiles.find(p => p.id === profileId);
    if (targetProfile) {
      simulator.currentUser = targetProfile;
      setCurrentUser(targetProfile);
      setAuthError(null);
      simulator.addLog(targetProfile.id, 'AUTH_SIGNIN', `Signed in as pre-seeded ${targetProfile.role}`);
    }
  };

  // Real Supabase Auth submission
  const handleAuthSubmit = async (e: any) => {
    e.preventDefault();
    setAuthError(null);

    if (!isSupabaseConfigured || !supabase) {
      setAuthError("Supabase environment variables are missing. Please use Sandbox quick login!");
      return;
    }

    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("Please fill in both email and password.");
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
          const profile = await db.getCurrentUser();
          setCurrentUser(profile);
          handleRefreshData();
        }
      } else {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              username: authEmail.split('@')[0],
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
      <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col items-center justify-center p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-black font-extrabold animate-bounce mb-4 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
          <Trophy className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Loading KickOff Arena...</p>
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
          <div className="rounded-3xl border border-white/5 bg-zinc-950/40 p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
            
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
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_4px_20px_rgba(6,182,212,0.15)]"
              >
                <LogIn className="h-4 w-4" />
                {authMode === 'signin' ? 'Authenticate via Supabase' : 'Create Supabase Account'}
              </button>
            </form>

            <div className="relative flex items-center justify-center py-1">
              <div className="absolute left-0 right-0 border-t border-white/5" />
              <span className="relative z-10 px-3 bg-zinc-950/80 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">or Sandbox Entry</span>
            </div>

            {/* Sandbox Quick Bypass profiles */}
            <div className="space-y-3.5">
              <div className="text-center space-y-1">
                <h4 className="text-xs font-extrabold text-white">Enter Live Sandbox Trial (Fast)</h4>
                <p className="text-[10px] text-zinc-500">Pick any pre-seeded profile to play around with the platform right now.</p>
              </div>

              <div className="space-y-2">
                {[
                  { id: 'u-admin', name: 'Okon (Admin)', desc: 'Full authority, approve matches, generate brackets', avatar: 'okon' },
                  { id: 'u-org1', name: 'Apex Host (Organizer)', desc: 'Host custom tournaments, approve player signups', avatar: 'apex' },
                  { id: 'u-p1', name: 'Xenon (Player)', desc: 'Join arenas, submit verified match scores', avatar: 'xenon' }
                ].map(prof => (
                  <button
                    key={prof.id}
                    onClick={() => handleSandboxLogin(prof.id)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 hover:border-cyan-500/30 text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 max-w-[85%]">
                      <img 
                        src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${prof.avatar}`} 
                        className="h-7 w-7 rounded bg-zinc-900 border border-white/5"
                        alt=""
                      />
                      <div className="truncate">
                        <p className="text-xs font-bold text-zinc-200 group-hover:text-cyan-400 transition-colors">{prof.name}</p>
                        <p className="text-[10px] text-zinc-500 truncate mt-0.5">{prof.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Quick instructions indicator for Supabase Paste */}
          <div className="text-center text-[10px] text-zinc-500 max-w-sm mx-auto space-y-2">
            <p>
              💡 This app uses a high-performance LocalStorage simulation fallback if Supabase keys are not set, meaning you can test it directly in the live iframe!
            </p>
          </div>

        </div>
      </div>
    );
  }

  // RENDER AUTHENTICATED PLATFORM MAIN DASHBOARD
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col font-sans pb-28 relative overflow-hidden">
      
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
        onRefreshNotifications={handleRefreshData}
      />

      {/* Main page stage */}
      <main className="flex-1 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 w-full relative z-10">
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
          <LeaderboardView games={games} />
        )}

        {activeTab === 'achievements' && (
          <AchievementsView currentUserId={currentUser.id} />
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

      {/* Role Switcher Hot-Swap Tool */}
      <RoleSwitcher 
        currentRole={currentUser.role} 
        onRoleChange={handleRoleChange} 
        isSupabaseConfigured={isSupabaseConfigured}
      />

    </div>
  );
}
