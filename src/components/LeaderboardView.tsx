import { useState, useEffect, useMemo } from 'react';
import { Trophy, Medal, Search, Star, Gamepad2, ArrowUp, Zap, Globe2 } from 'lucide-react';
import { Leaderboard, Game, Tournament } from '../types';
import { db } from '../services/db';

interface LeaderboardViewProps {
  games: Game[];
  tournaments: Tournament[];
}

export default function LeaderboardView({ games, tournaments }: LeaderboardViewProps) {
  const [selectedGame, setSelectedGame] = useState<string>('overall');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [leaders, setLeaders] = useState<Leaderboard[]>([]);
  const [loading, setLoading] = useState(true);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredLeaders = useMemo(() => leaders.filter((entry) => {
    const name = entry.username?.toLowerCase() || 'anonymous player';
    return name.includes(normalizedSearch) || entry.user_id.toLowerCase().includes(normalizedSearch);
  }), [leaders, normalizedSearch]);

  useEffect(() => {
    async function loadLeaders() {
      setLoading(true);
      try {
        let data: Leaderboard[] = [];
        if (selectedTournamentId !== 'all') {
          data = await db.getTournamentLeaderboard(selectedTournamentId);
        } else if (selectedGame === 'overall') {
          data = await db.getOverallLeaderboard();
        } else {
          data = await db.getLeaderboard(selectedGame);
        }
        setLeaders(data);
      } catch (err) {
        console.error('Error loading leaderboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLeaders();
  }, [selectedGame, selectedTournamentId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-left">
      <div className="rounded-[28px] border border-white/10 bg-zinc-950/60 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-400">Competitive pulse</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Esports Leaderboards</h1>
          </div>
          <p className="max-w-xl text-sm text-zinc-400">Track regional rankings, claim points from verified wins, and see who’s on the rise.</p>
        </div>
      </div>

      {/* Game Selector Row */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/5">
        <button
          onClick={() => setSelectedGame('overall')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer truncate ${
            selectedGame === 'overall'
              ? 'bg-cyan-500 text-black border-cyan-500 shadow-lg shadow-cyan-500/10'
              : 'bg-zinc-900/40 text-zinc-400 border-white/5 hover:text-white hover:bg-zinc-850/40'
          }`}
        >
          <Globe2 className="h-3.5 w-3.5" />
          Overall
        </button>
        {games.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelectedGame(g.id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer truncate ${
              selectedGame === g.id
                ? 'bg-cyan-500 text-black border-cyan-500 shadow-lg shadow-cyan-500/10'
                : 'bg-zinc-900/40 text-zinc-400 border-white/5 hover:text-white hover:bg-zinc-850/40'
            }`}
          >
            <Gamepad2 className="h-3.5 w-3.5" />
            {g.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Leaderboard</p>
          <p className="text-[11px] text-zinc-400">Search players and compare ranking points in your live esports leaderboard.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search competitors"
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <select
            value={selectedTournamentId}
            onChange={(e) => setSelectedTournamentId(e.target.value)}
            className="w-full sm:w-72 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
          >
            <option value="all">All tournaments</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="rounded-[28px] border border-white/10 bg-zinc-950/60 overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.3)] backdrop-blur-xl">
        <div className="grid grid-cols-12 px-6 py-4 border-b border-white/5 bg-zinc-900/50 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          <div className="col-span-2 text-center">Rank</div>
          <div className="col-span-6">Competitor</div>
          <div className="col-span-4 text-right">Points</div>
        </div>

        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-zinc-900/40 border border-white/5 rounded-xl" />
            ))}
          </div>
        ) : leaders.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500">
            No rankings reported for this esports game yet. Start playing tournaments to score rank points!
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredLeaders.map((entry, index) => {
              const rank = index + 1;
              const isTop3 = rank <= 3;

              return (
                <div 
                  key={entry.id} 
                  className={`grid grid-cols-12 px-6 py-4 items-center transition-all ${
                    rank === 1 ? 'bg-yellow-500/5' : ''
                  }`}
                >
                  {/* Rank */}
                  <div className="col-span-2 flex justify-center">
                    {rank === 1 ? (
                      <span className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400">
                        <Medal className="h-5 w-5" />
                      </span>
                    ) : rank === 2 ? (
                      <span className="p-1.5 rounded-lg bg-zinc-300/10 text-zinc-300">
                        <Medal className="h-5 w-5" />
                      </span>
                    ) : rank === 3 ? (
                      <span className="p-1.5 rounded-lg bg-amber-600/10 text-amber-600">
                        <Medal className="h-5 w-5" />
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-zinc-400">#{rank}</span>
                    )}
                  </div>

                  {/* Competitor */}
                  <div className="col-span-6 flex items-center gap-3">
                    <img 
                      src={entry.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + entry.user_id} 
                      alt="" 
                      className="h-8 w-8 rounded-lg bg-zinc-950 object-cover border border-white/5"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <p className="text-xs font-bold text-white">{entry.username || 'Anonymous Player'}</p>
                      <p className="text-[10px] text-zinc-500">Competitive Division 1</p>
                    </div>
                  </div>

                  {/* Points */}
                  <div className="col-span-4 text-right flex items-center justify-end gap-1.5">
                    <span className="text-sm font-black text-cyan-400 font-mono">{entry.rank_points}</span>
                    <span className="text-[9px] font-bold uppercase text-zinc-650 bg-zinc-900 px-1.5 py-0.5 rounded">PTS</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Point details ticker */}
      <div className="rounded-xl border border-white/5 p-4 bg-zinc-950/20 backdrop-blur-sm flex items-start gap-3">
        <Zap className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-white">How Rank Points (PTS) Work</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Every win in a verified tournament bracket awards +100 PTS on the leaderboard. Winning a Grand Championship rewards +300 PTS. Keep competing to lock down your position!
          </p>
        </div>
      </div>

    </div>
  );
}
