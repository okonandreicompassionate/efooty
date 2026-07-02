import { useState, useEffect } from 'react';
import { 
  Trophy, User, Gamepad2, Calendar, TrendingUp, Sparkles, 
  ArrowRight, Clock, ShieldCheck, Award, Zap, Activity, MessageSquare, Swords
} from 'lucide-react';
import { Profile, Tournament, PlayerStatistics, ActivityLog, Game, FriendChallenge, TournamentPlayer } from '../types';
import { db } from '../services/db';
import ChatBox from './ChatBox';

interface DashboardViewProps {
  currentUser: Profile;
  tournaments: Tournament[];
  games: Game[];
  setActiveTab: (tab: string) => void;
  setSelectedTournamentId: (id: string) => void;
}

export default function DashboardView({ 
  currentUser, 
  tournaments, 
  games, 
  setActiveTab,
  setSelectedTournamentId
}: DashboardViewProps) {
  const [stats, setStats] = useState<PlayerStatistics[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [userAchievements, setUserAchievements] = useState<string[]>([]);
  const [friendChallenges, setFriendChallenges] = useState<FriendChallenge[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<TournamentPlayer[]>([]);
  const [challengeOpponent, setChallengeOpponent] = useState('');
  const [challengeTitle, setChallengeTitle] = useState('Friendly showdown');
  const [challengeGame, setChallengeGame] = useState(games[0]?.id || '');
  const [challengeMessage, setChallengeMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if ((!challengeGame || !games.some(game => game.id === challengeGame)) && games.length > 0) {
      setChallengeGame(games[0].id);
    }
  }, [games, challengeGame]);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, logsData, achData, challengeData, myRegsData] = await Promise.all([
          db.getPlayerStats(currentUser.id),
          db.getActivityLogs(currentUser.id),
          db.getUserAchievements(currentUser.id),
          db.getFriendChallenges(),
          db.getMyTournamentRegistrations(currentUser.id)
        ]);
        setStats(statsData);
        setLogs(logsData.slice(0, 5)); // show recent 5
        setUserAchievements(achData.map(a => a.achievement_id));
        setFriendChallenges(challengeData.filter(ch => ch.host_id === currentUser.id || ch.opponent_id === currentUser.id));
        setMyRegistrations(myRegsData);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentUser.id]);

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeOpponent.trim()) return;
    try {
      const created = await db.createFriendChallenge(currentUser.id, challengeOpponent.trim(), challengeGame, challengeTitle.trim() || 'Friendly showdown');
      setFriendChallenges(prev => [created, ...prev]);
      setChallengeMessage(`Challenge sent to ${challengeOpponent.trim()}.`);
      setChallengeOpponent('');
      setChallengeTitle('Friendly showdown');
    } catch (err) {
      console.error('Failed to create challenge', err);
      setChallengeMessage('Unable to create the challenge right now.');
    }
  };

  const handleAcceptChallenge = async (challengeId: string) => {
    try {
      const accepted = await db.acceptFriendChallenge(challengeId, currentUser.id);
      setFriendChallenges(prev => prev.map(ch => ch.id === accepted.id ? accepted : ch));
      setChallengeMessage('Challenge accepted. Your friendly match is now in progress.');
    } catch (err) {
      console.error('Failed to accept challenge', err);
      setChallengeMessage('Unable to accept the challenge right now.');
    }
  };

  // Derive general platform info
  const activeTournaments = tournaments.filter(t => t.status === 'active');
  const registrationTournaments = tournaments.filter(t => t.status === 'registration');
  const completedTournaments = tournaments.filter(t => t.status === 'completed');
  const hostedTournaments = tournaments.filter(t => t.organizer_id === currentUser.id);
  const myTournamentIds = new Set(myRegistrations.map(reg => reg.tournament_id));
  const myTournaments = tournaments.filter(t => myTournamentIds.has(t.id));

  // Calculate cumulative stats across games for current user
  const totalPlayed = stats.reduce((acc, s) => acc + s.matches_played, 0);
  const totalWon = stats.reduce((acc, s) => acc + s.matches_won, 0);
  const totalLost = stats.reduce((acc, s) => acc + s.matches_lost, 0);
  const winRate = totalPlayed > 0 ? Math.round((totalWon / totalPlayed) * 100) : 0;

  // Render Skeleton Loader if loading
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-gray-900/40 border border-gray-800 rounded-2xl w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-gray-900/40 border border-gray-800 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-gray-900/40 border border-gray-800 rounded-2xl" />
          <div className="h-80 bg-gray-900/40 border border-gray-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-950/40 p-6 sm:p-8 shadow-xl backdrop-blur-md">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute left-1/3 bottom-0 -mb-24 h-56 w-56 rounded-full bg-indigo-500/5 blur-3xl" />
        
        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
              <Sparkles className="h-3 w-3" />
              Pre-Seeded Competitive Season Live
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome back, <span className="text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-indigo-400">{currentUser.username}</span>!
            </h1>
            <p className="text-sm text-zinc-400 max-w-lg">
              Manage your esports tournaments, register for upcoming matchmaking brackets, submit verified scorecards, and dominate the charts.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button 
              onClick={() => {
                setSelectedTournamentId('new');
                setActiveTab('tournaments');
              }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 font-semibold transition-all hover:bg-cyan-500/20 cursor-pointer"
            >
              Host Tournament
            </button>
            <button 
              onClick={() => setActiveTab('tournaments')}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all hover:scale-105 cursor-pointer"
            >
              Explore Tournaments
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-5 hover:border-white/10 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-zinc-400">Active Arenas</span>
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Gamepad2 className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-white">{activeTournaments.length} Live</h3>
            <p className="text-xs text-zinc-500 mt-1">{registrationTournaments.length} in sign-up phase</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-5 hover:border-white/10 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-zinc-400">Matches Scheduled</span>
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Calendar className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-white">4 Active</h3>
            <p className="text-xs text-zinc-500 mt-1">{completedTournaments.length} tournaments completed</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-5 hover:border-white/10 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-zinc-400">My Matches Played</span>
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-white">{totalPlayed} Matches</h3>
            <p className="text-xs text-zinc-500 mt-1">{totalWon} wins / {totalLost} losses</p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-5 hover:border-white/10 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-zinc-400">My Win Rate</span>
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-white">{winRate}%</h3>
            <div className="w-full bg-zinc-900 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-cyan-500 h-1.5 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" 
                style={{ width: `${winRate}%` }} 
              />
            </div>
          </div>
        </div>

      </div>

      {/* Main Grid: Activity Logs & Games & Registered Bracket Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column (2 cols wide) - Games, Tournaments list */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Browse games */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Supported Esports Games</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {games.map((g) => (
                <div 
                  key={g.id} 
                  className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/2 hover:border-cyan-500/30 hover:bg-white/5 transition-all duration-300 text-center cursor-pointer"
                  onClick={() => setActiveTab('tournaments')}
                >
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/5 text-cyan-400 group-hover:bg-cyan-500/10 group-hover:text-cyan-300 transition-colors mb-2">
                    <Gamepad2 className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-zinc-200 block truncate">{g.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Friendly Challenge Hub */}
          <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Friendly Challenge Hub</h2>
                <p className="text-xs text-zinc-500">Create quick friend-play matches, track them, and build points without a full bracket.</p>
              </div>
              <div className="rounded-full bg-cyan-500/10 p-2 text-cyan-400">
                <Swords className="h-4 w-4" />
              </div>
            </div>

            <form onSubmit={handleCreateChallenge} className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_auto]">
              <input
                value={challengeOpponent}
                onChange={(e) => setChallengeOpponent(e.target.value)}
                placeholder="Opponent name"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-zinc-500"
              />
              <input
                value={challengeTitle}
                onChange={(e) => setChallengeTitle(e.target.value)}
                placeholder="Friendly showdown"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-zinc-500"
              />
              <select value={challengeGame} onChange={(e) => setChallengeGame(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white">
                {games.length === 0 ? (
                  <option value="" disabled>Loading games...</option>
                ) : (
                  games.map(game => <option key={game.id} value={game.id}>{game.name}</option>)
                )}
              </select>
              <div className="md:col-span-3 flex items-center justify-between gap-3">
                <span className="text-[11px] text-zinc-500">Verified wins award rank points and show up in your challenge history.</span>
                <button type="submit" className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-black">Create challenge</button>
              </div>
            </form>

            {challengeMessage && <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">{challengeMessage}</div>}

            <div className="space-y-2">
              {friendChallenges.length === 0 ? (
                <p className="text-xs text-zinc-500">No challenges yet. Start one and keep the friendly season moving.</p>
              ) : (
                friendChallenges.slice(0, 4).map(challenge => (
                  <div key={challenge.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-900/30 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{challenge.title}</p>
                      <p className="text-[11px] text-zinc-500">{challenge.status} • {challenge.integrity_status || 'pending'}</p>
                    </div>
                    {challenge.status === 'pending' && challenge.host_id !== currentUser.id && (
                      <button onClick={() => handleAcceptChallenge(challenge.id)} className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-300">Accept</button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">My Tournaments</h2>
              <button onClick={() => setActiveTab('tournaments')} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-semibold">Browse</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myTournaments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-5 text-xs text-zinc-500 md:col-span-2">
                  Joined tournaments will appear here.
                </div>
              ) : (
                myTournaments.slice(0, 4).map(t => {
                  const reg = myRegistrations.find(item => item.tournament_id === t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTournamentId(t.id);
                        setActiveTab('tournaments');
                      }}
                      className="rounded-xl border border-white/5 bg-zinc-950/40 p-4 text-left hover:border-cyan-500/20"
                    >
                      <span className="mb-2 inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-300">
                        {reg?.status || t.status}
                      </span>
                      <p className="truncate text-sm font-bold text-white">{t.title}</p>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {new Date(t.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Featured Tournaments */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Featured Open Tournaments</h2>
              <button 
                onClick={() => setActiveTab('tournaments')}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-semibold flex items-center gap-1 cursor-pointer"
              >
                View all
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tournaments.slice(0, 2).map((t) => {
                const game = games.find(g => g.id === t.game_id);
                return (
                  <div 
                    key={t.id} 
                    onClick={() => {
                      setSelectedTournamentId(t.id);
                      setActiveTab('tournaments');
                    }}
                    className="group overflow-hidden rounded-xl border border-white/5 bg-zinc-950/40 hover:border-white/10 transition-all cursor-pointer shadow-lg"
                  >
                    <div className="h-28 overflow-hidden relative">
                      <img 
                        src={t.banner_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600'} 
                        alt={t.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <span className={`absolute top-3 right-3 text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full backdrop-blur-md border ${
                        t.status === 'registration' 
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
                          : t.status === 'active' 
                          ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' 
                          : 'bg-zinc-500/10 text-zinc-400 border-white/5'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                    <div className="p-4 space-y-2">
                      <p className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-widest">{game?.name || 'Esports Match'}</p>
                      <h3 className="font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-1">{t.title}</h3>
                      <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-white/5">
                        <span>Pool: <span className="text-white font-semibold">{t.prize_pool || 'N/A'}</span></span>
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-zinc-500" />
                          max {t.max_players}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right column (1 col wide) - Recent activity logs, achievements */}
        <div className="space-y-6">
          {hostedTournaments.length > 0 && (
            <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-5">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
                Host Dashboard
              </h2>
              <div className="space-y-3">
                {hostedTournaments.slice(0, 4).map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTournamentId(t.id);
                      setActiveTab('tournaments');
                    }}
                    className="w-full rounded-xl border border-white/5 bg-zinc-950/40 px-3 py-3 text-left hover:border-cyan-500/25"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-white">{t.title}</p>
                      <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] uppercase text-cyan-300">{t.status}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">Capacity {t.max_players} players</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Achievements Summary */}
          <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-5">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Award className="h-4 w-4 text-cyan-400" />
              Achievements
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {db.getAchievements().then(achList => {} /* just referencing the list */) && [
                { id: 'ac1', name: 'First Victory', icon: 'Award', color: 'bg-cyan-500/10 text-cyan-400' },
                { id: 'ac2', name: 'Flawless Win', icon: 'Zap', color: 'bg-yellow-500/10 text-yellow-400' },
                { id: 'ac3', name: 'Champion Ascent', icon: 'Trophy', color: 'bg-purple-500/10 text-purple-400' },
                { id: 'ac4', name: 'Tournament Spree', icon: 'Flame', color: 'bg-red-500/10 text-red-400' }
              ].map(ach => {
                const isEarned = userAchievements.includes(ach.id);
                return (
                  <div 
                    key={ach.id} 
                    className={`aspect-square flex flex-col items-center justify-center rounded-xl border transition-all ${
                      isEarned 
                        ? `${ach.color} border-cyan-500/20` 
                        : 'bg-zinc-900/20 border-white/5 opacity-40'
                    }`}
                    title={`${ach.name} (${isEarned ? 'Earned' : 'Locked'})`}
                  >
                    <Trophy className="h-5 w-5 mb-1" />
                    <span className="text-[8px] font-semibold text-center truncate w-full px-1">{ach.name}</span>
                  </div>
                );
              })}
            </div>
            <button 
              onClick={() => setActiveTab('achievements')}
              className="w-full mt-4 py-2 text-center text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/5 rounded-lg border border-cyan-500/10 transition-colors cursor-pointer"
            >
              View Badges
            </button>
          </div>

          {/* Activity Feed */}
          <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-5">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              Recent Activities
            </h2>

            <div className="space-y-4">
              {logs.length === 0 ? (
                <p className="text-xs text-zinc-500">No activity logs recorded yet.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex gap-3 items-start text-xs border-b border-white/5 pb-3 last:border-0 last:pb-0">
                    <div className="h-2 w-2 rounded-full bg-cyan-400 mt-1.5 shrink-0 shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
                    <div>
                      <p className="font-semibold text-zinc-200 leading-tight">{log.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded uppercase font-medium">
                          {log.action_type.split('_')[1] || log.action_type}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Global Arena Lounge Chat */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-white">Global Arena Lounge</h2>
        </div>
        <ChatBox currentUser={currentUser} tournamentId="global" title="Global Chat Lobby" />
      </div>

    </div>
  );
}
