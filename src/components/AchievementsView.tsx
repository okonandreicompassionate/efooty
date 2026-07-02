import { useState, useEffect } from 'react';
import { Trophy, Award, Zap, Shield, Flame, Star, CheckCircle, Lock } from 'lucide-react';
import { Achievement } from '../types';
import { db } from '../services/db';

interface AchievementsViewProps {
  currentUserId: string;
}

export default function AchievementsView({ currentUserId }: AchievementsViewProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [earnedIds, setEarnedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAchievements() {
      setLoading(true);
      try {
        const [all, earned] = await Promise.all([
          db.getAchievements(),
          db.getUserAchievements(currentUserId)
        ]);
        setAchievements(all);
        setEarnedIds(earned.map(e => e.achievement_id));
      } catch (err) {
        console.error('Error loading achievements:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAchievements();
  }, [currentUserId]);

  // Calculate stats
  const totalXp = earnedIds.reduce((sum, earnedId) => {
    const ach = achievements.find(a => a.id === earnedId);
    return sum + (ach ? ach.xp_reward : 0);
  }, 0);

  const getIcon = (badgeIcon: string) => {
    switch (badgeIcon) {
      case 'Award': return Award;
      case 'Zap': return Zap;
      case 'Trophy': return Trophy;
      case 'Flame': return Flame;
      case 'Shield': return Shield;
      default: return Trophy;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-16 bg-zinc-900/40 border border-white/5 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-zinc-900/40 border border-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-left">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Achievements & Badges</h1>
        <p className="text-sm text-zinc-400">Unlock seasonal badges and earn XP rewards by completing match milestones.</p>
      </div>

      {/* XP Tracker Progress Banner */}
      <div className="rounded-2xl border border-cyan-500/10 bg-zinc-950/40 backdrop-blur-sm p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_15px_rgba(6,182,212,0.02)]">
        <div className="space-y-1.5 text-center sm:text-left">
          <span className="text-[10px] font-extrabold uppercase bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-full">Season 1 Level Progress</span>
          <h3 className="text-lg font-extrabold text-white mt-1">XP Gathered: <span className="text-cyan-400">{totalXp} XP</span></h3>
          <p className="text-xs text-zinc-400">Next rank milestone unlock: {totalXp >= 1000 ? 'Master Competitor achieved!' : `${1000 - totalXp} XP remaining`}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500 text-black font-extrabold text-lg shadow-[0_0_15px_rgba(6,182,212,0.4)]">
          <Star className="h-6 w-6 animate-spin" style={{ animationDuration: '6s' }} />
        </div>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {achievements.map((ach) => {
          const isEarned = earnedIds.includes(ach.id);
          const Icon = getIcon(ach.badge_icon);

          return (
            <div 
              key={ach.id} 
              className={`rounded-2xl border p-5 flex gap-4 transition-all ${
                isEarned 
                  ? 'border-cyan-500/20 bg-zinc-900/30 shadow-[0_4px_20px_rgba(6,182,212,0.03)]' 
                  : 'border-white/5 bg-zinc-950/10 opacity-55'
              }`}
            >
              {/* Badge Emblem */}
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                isEarned 
                  ? 'bg-cyan-500/10 text-cyan-400 ring-2 ring-cyan-500/20' 
                  : 'bg-zinc-900 text-zinc-650 ring-1 ring-white/5'
              }`}>
                <Icon className="h-6 w-6" />
              </div>

              {/* Achievement description */}
              <div className="space-y-1.5 flex-1 text-left">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-white">{ach.name}</h4>
                  {isEarned ? (
                    <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-bold bg-cyan-500/5 px-2 py-0.5 rounded-full border border-cyan-500/10">
                      <CheckCircle className="h-3 w-3" />
                      Earned
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-semibold bg-zinc-900 px-2 py-0.5 rounded-full">
                      <Lock className="h-3 w-3" />
                      Locked
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{ach.description}</p>
                <span className="inline-block text-[10px] font-mono font-bold text-zinc-500">
                  REWARD: <span className="text-cyan-400 font-bold">+{ach.xp_reward} XP</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
