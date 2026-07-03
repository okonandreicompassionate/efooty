import { useState, useEffect } from 'react';
import { ArrowLeft, Trophy } from 'lucide-react';
import { db } from '../services/db';
import BracketTree from './BracketTree';
import { Match, Profile, Tournament, Game } from '../types';

const guestProfile: Profile = {
  id: 'guest',
  username: 'Guest',
  email: '',
  role: 'player',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

interface EmbedViewProps {
  tournamentId: string;
}

export default function EmbedView({ tournamentId }: EmbedViewProps) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEmbed = async () => {
      try {
        setLoading(true);
        setError(null);

        const [tournamentData, matchData, profileData, gamesData] = await Promise.all([
          db.getTournament(tournamentId),
          db.getMatches(tournamentId),
          db.getProfiles(),
          db.getGames()
        ]);

        if (!tournamentData) {
          setError('Tournament not found.');
          return;
        }

        setTournament(tournamentData);
        setMatches(matchData || []);
        setProfiles(profileData || []);
        setGame(gamesData.find(g => g.id === tournamentData.game_id) || null);
      } catch (err) {
        console.error('Unable to load tournament embed:', err);
        setError('Unable to load tournament embed right now.');
      } finally {
        setLoading(false);
      }
    };

    loadEmbed();
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05070b] text-white flex items-center justify-center p-6">
        <div className="rounded-3xl bg-zinc-950/90 border border-white/10 p-8 shadow-2xl text-center">
          <Trophy className="mx-auto mb-4 h-12 w-12 text-cyan-400" />
          <p className="text-sm font-semibold">Loading tournament broadcast...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#05070b] text-white flex items-center justify-center p-6">
        <div className="rounded-3xl bg-zinc-950/90 border border-red-500/20 p-8 shadow-2xl text-center">
          <p className="text-sm font-semibold text-red-300 mb-3">{error}</p>
          <a href="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" /> Back to eTournament
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070a11] text-white p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-zinc-950/80 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-widest text-cyan-300">
                <Trophy className="h-3.5 w-3.5" /> Live Embed
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-white">{tournament?.title || 'Tournament Embed'}</h1>
                <p className="text-sm text-gray-400">{game?.name || 'Esports'} • {tournament?.status || 'Unknown status'}</p>
              </div>
            </div>
            <a href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
              Return home
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-black/60 p-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Organizer</span>
              <p className="mt-2 text-sm font-semibold text-white">{profiles.find(p => p.id === tournament.organizer_id)?.username || 'Host'}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/60 p-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Start time</span>
              <p className="mt-2 text-sm font-semibold text-white">{new Date(tournament.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/60 p-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Format</span>
              <p className="mt-2 text-sm font-semibold text-white capitalize">{tournament.format.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-5 shadow-2xl">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">Bracket view</h2>
          <div className="mt-5 overflow-x-auto">
            <BracketTree matches={matches} profiles={profiles} currentUser={guestProfile} onMatchSelect={() => {}} />
          </div>
        </div>
      </div>
    </div>
  );
}
