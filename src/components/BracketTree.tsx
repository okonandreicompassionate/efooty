import { Award, Clock, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Match, Profile } from '../types';

const formatDateTime = (value?: string) => {
  if (!value) return 'TBD';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'TBD' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

interface BracketTreeProps {
  matches: Match[];
  profiles: Profile[];
  currentUser: Profile;
  onMatchSelect: (match: Match) => void;
}

export default function BracketTree({ matches, profiles, currentUser, onMatchSelect }: BracketTreeProps) {
  const roundNumbers = Array.from(new Set(matches.map((m) => m.round_no))).sort((a, b) => a - b);
  const matchesByRound: Record<number, Match[]> = roundNumbers.reduce((acc, round) => {
    acc[round] = matches
      .filter((m) => m.round_no === round)
      .sort((a, b) => a.match_no - b.match_no);
    return acc;
  }, {} as Record<number, Match[]>);

  const getPlayerName = (id?: string) => {
    if (!id) return 'TBD';
    const profile = profiles.find(p => p.id === id);
    return profile ? profile.username : 'Unknown';
  };

  const getPlayerAvatar = (id?: string) => {
    if (!id) return undefined;
    const profile = profiles.find(p => p.id === id);
    return profile?.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + id;
  };

  const renderMatchCard = (match: Match) => {
    const isP1Winner = match.winner_id && match.winner_id === match.player1_id;
    const isP2Winner = match.winner_id && match.winner_id === match.player2_id;
    const isCurrentUserParticipant = currentUser.id === match.player1_id || currentUser.id === match.player2_id;

    return (
      <div 
        key={match.id}
        onClick={() => onMatchSelect(match)}
        className={`relative group rounded-xl border p-3.5 transition-all duration-300 bg-zinc-950/40 backdrop-blur-sm cursor-pointer ${
          match.status === 'playing' 
            ? 'border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.05)]' 
            : match.status === 'disputed'
            ? 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.05)] bg-red-950/5'
            : match.status === 'completed'
            ? 'border-white/5 hover:border-white/10'
            : 'border-white/5 opacity-60 hover:opacity-100'
        }`}
      >
        {/* Status indicator pill */}
        <div className="absolute -top-2.5 left-3 flex gap-1 items-center">
          <span className={`text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
            match.status === 'playing'
              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
              : match.status === 'disputed'
              ? 'bg-red-500/10 text-red-400 border-red-500/20'
              : match.status === 'completed'
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
              : 'bg-zinc-800 text-zinc-500 border-zinc-700/50'
          }`}>
            {match.status}
          </span>
          {isCurrentUserParticipant && (
            <span className="text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
              Your Match
            </span>
          )}
        </div>

        <div className="space-y-2 mt-1">
          {/* Player 1 */}
          <div className={`flex items-center justify-between rounded-lg p-1.5 transition-colors ${
            isP1Winner ? 'bg-cyan-500/5' : ''
          }`}>
            <div className="flex items-center gap-2 max-w-[120px] truncate">
              {match.player1_id ? (
                <img 
                  src={getPlayerAvatar(match.player1_id)} 
                  className="h-5 w-5 rounded bg-zinc-800 object-cover border border-white/5"
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-5 w-5 rounded bg-zinc-900 border border-white/5 flex items-center justify-center text-[8px] text-zinc-600 font-bold">?</div>
              )}
              <span className={`text-xs font-semibold truncate ${
                isP1Winner ? 'text-cyan-400 font-bold' : match.player1_id ? 'text-zinc-200' : 'text-zinc-500'
              }`}>
                {getPlayerName(match.player1_id)}
              </span>
            </div>
            <span className={`text-xs font-bold px-2 rounded ${
              isP1Winner ? 'text-cyan-400 bg-cyan-500/10' : 'text-zinc-400 bg-zinc-900/60'
            }`}>
              {match.player1_score}
            </span>
          </div>

          {/* Divider line */}
          <div className="border-t border-white/5" />

          {/* Player 2 */}
          <div className={`flex items-center justify-between rounded-lg p-1.5 transition-colors ${
            isP2Winner ? 'bg-cyan-500/5' : ''
          }`}>
            <div className="flex items-center gap-2 max-w-[120px] truncate">
              {match.player2_id ? (
                <img 
                  src={getPlayerAvatar(match.player2_id)} 
                  className="h-5 w-5 rounded bg-zinc-800 object-cover border border-white/5"
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-5 w-5 rounded bg-zinc-900 border border-white/5 flex items-center justify-center text-[8px] text-zinc-600 font-bold">?</div>
              )}
              <span className={`text-xs font-semibold truncate ${
                isP2Winner ? 'text-cyan-400 font-bold' : match.player2_id ? 'text-zinc-200' : 'text-zinc-500'
              }`}>
                {getPlayerName(match.player2_id)}
              </span>
            </div>
            <span className={`text-xs font-bold px-2 rounded ${
              isP2Winner ? 'text-cyan-400 bg-cyan-500/10' : 'text-zinc-400 bg-zinc-900/60'
            }`}>
              {match.player2_score}
            </span>
          </div>
        </div>

        {match.scheduled_time && (
          <div className="mt-2 text-[10px] text-zinc-500 flex items-center justify-between">
            <span>{formatDateTime(match.scheduled_time)}</span>
            <span className="text-zinc-600">Scheduled</span>
          </div>
        )}

        {/* Hover detail hint */}
        <div className="mt-2 text-[10px] text-zinc-500 text-right opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-0.5">
          Match Details
          <ArrowRight className="h-2.5 w-2.5" />
        </div>
      </div>
    );
  };

  if (roundNumbers.length === 0) {
    return (
      <div className="w-full rounded-3xl border border-white/10 bg-zinc-950/70 p-8 text-center text-sm text-zinc-400">
        No bracket matches are available yet. Generate the bracket or approve players to start.
      </div>
    );
  }

  const maxRound = Math.max(...roundNumbers);
  return (
    <div className="w-full overflow-x-auto pb-6">
      <div
        className="grid gap-8 relative py-4"
        style={{
          minWidth: Math.max(750, roundNumbers.length * 280),
          gridTemplateColumns: `repeat(${roundNumbers.length}, minmax(0, 1fr))`
        }}
      >
        {roundNumbers.map((round) => {
          const roundMatches = matchesByRound[round] || [];
          const heading = round === maxRound
            ? 'Grand Finals'
            : round === maxRound - 1
              ? 'Semifinals'
              : round === maxRound - 2
                ? 'Quarterfinals'
                : `Round ${round}`;

          return (
            <div key={round} className="space-y-8 flex flex-col justify-center">
              <div className="text-center mb-2">
                <h4 className={`text-xs font-extrabold uppercase tracking-widest ${round === maxRound ? 'text-cyan-400' : 'text-zinc-400'}`}>
                  {heading}
                </h4>
                <span className="text-[10px] text-zinc-600">{roundMatches.length} Matches</span>
              </div>
              {roundMatches.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-500 border border-dashed border-white/10 rounded-xl">
                  {round === 1 ? 'Pending approved players' : `Waiting for Round ${round - 1}`}
                </div>
              ) : (
                roundMatches.map(m => renderMatchCard(m))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
