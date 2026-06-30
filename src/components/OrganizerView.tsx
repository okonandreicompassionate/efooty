import { useState, useEffect } from 'react';
import { 
  Shield, Trophy, Users, PlusCircle, AlertTriangle, 
  CheckCircle, FileText, Settings, PlayCircle, HelpCircle
} from 'lucide-react';
import { Tournament, Profile, TournamentPlayer, Match } from '../types';
import { db } from '../services/db';

interface OrganizerViewProps {
  currentUser: Profile;
  tournaments: Tournament[];
  profiles: Profile[];
  setActiveTab: (tab: string) => void;
  setSelectedTournamentId: (id: string | null) => void;
  onRefreshTournaments: () => void;
}

export default function OrganizerView({ 
  currentUser, 
  tournaments, 
  profiles, 
  setActiveTab,
  setSelectedTournamentId,
  onRefreshTournaments
}: OrganizerViewProps) {
  const [pendingRegs, setPendingRegs] = useState<(TournamentPlayer & { tournamentTitle: string })[]>([]);
  const [disputedMatches, setDisputedMatches] = useState<(Match & { tournamentTitle: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHubData() {
      setLoading(true);
      try {
        // Find all pending registrations for tournaments owned by the current organizer (or all if admin)
        const myTournaments = tournaments.filter(t => currentUser.role === 'admin' || t.organizer_id === currentUser.id);
        
        const regsPromises = myTournaments.map(async t => {
          const players = await db.getTournamentPlayers(t.id);
          return players
            .filter(p => p.status === 'pending')
            .map(p => ({ ...p, tournamentTitle: t.title }));
        });

        const matchesPromises = myTournaments.map(async t => {
          const matchesList = await db.getMatches(t.id);
          return matchesList
            .filter(m => m.status === 'disputed')
            .map(m => ({ ...m, tournamentTitle: t.title }));
        });

        const regsResult = await Promise.all(regsPromises);
        const matchesResult = await Promise.all(matchesPromises);

        setPendingRegs(regsResult.flat());
        setDisputedMatches(matchesResult.flat());
      } catch (err) {
        console.error('Error fetching hub details:', err);
      } finally {
        setLoading(false);
      }
    }

    loadHubData();
  }, [tournaments, currentUser.id, currentUser.role]);

  const handleAction = async (regId: string, status: 'approved' | 'rejected') => {
    try {
      await db.approvePlayer(regId, status);
      onRefreshTournaments();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const getPlayerName = (id: string) => profiles.find(p => p.id === id)?.username || 'Unknown';

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse text-left">
        <div className="h-20 bg-gray-900/40 border border-gray-800 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-60 bg-gray-900/40 border border-gray-800 rounded-2xl" />
          <div className="h-60 bg-gray-900/40 border border-gray-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-left">
      
      {/* Header Banner */}
      <div className="rounded-2xl border border-cyan-500/10 bg-zinc-950/40 backdrop-blur-sm p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_15px_rgba(6,182,212,0.02)]">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-cyan-400" />
            Organizer Control Hub
          </h1>
          <p className="text-sm text-zinc-400">Host brackets, review pending scorecards, and approve user registrations.</p>
        </div>
        <button
          onClick={() => {
            setSelectedTournamentId('new');
            setActiveTab('tournaments');
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-xl text-xs transition-transform hover:scale-103 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.3)]"
        >
          <PlusCircle className="h-4 w-4" />
          Host New Tournament
        </button>
      </div>

      {/* Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Pending approvals column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Pending registrations card */}
          <div className="rounded-2xl border border-white/5 bg-zinc-950/40 overflow-hidden shadow-xl backdrop-blur-sm">
            <div className="p-4 border-b border-white/5 bg-zinc-900/50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-4 w-4 text-cyan-400" />
                Pending Registrations Checklist
              </h3>
              <span className="text-xs text-zinc-400 font-mono font-bold bg-zinc-900 px-2 py-0.5 rounded-full">{pendingRegs.length} Pending</span>
            </div>

            <div className="divide-y divide-white/5">
              {pendingRegs.length === 0 ? (
                <div className="p-12 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                  <CheckCircle className="h-8 w-8 text-cyan-400" />
                  <p className="font-bold text-zinc-300">All Registrations Screened</p>
                  <p className="text-[11px] text-zinc-500">No pending entries requiring host validation.</p>
                </div>
              ) : (
                pendingRegs.map((reg) => (
                  <div key={reg.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-white">
                        {getPlayerName(reg.player_id)} 
                        <span className="text-[10px] font-normal text-zinc-500 ml-1.5">signs up for</span>
                      </p>
                      <p className="text-[11px] text-cyan-400 font-semibold">{reg.tournamentTitle}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAction(reg.id, 'approved')}
                        className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg text-[10px] transition-colors cursor-pointer"
                      >
                        Approve Slot
                      </button>
                      <button
                        onClick={() => handleAction(reg.id, 'rejected')}
                        className="px-2.5 py-1 border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-lg text-[10px] transition-colors cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Matches score approvals list */}
          <div className="rounded-2xl border border-white/5 bg-zinc-950/40 overflow-hidden shadow-xl backdrop-blur-sm">
            <div className="p-4 border-b border-white/5 bg-zinc-900/50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-cyan-400" />
                Score Reports Pending Verification
              </h3>
              <span className="text-xs text-zinc-400 font-mono font-bold bg-zinc-900 px-2 py-0.5 rounded-full">{disputedMatches.length} Pending</span>
            </div>

            <div className="divide-y divide-white/5">
              {disputedMatches.length === 0 ? (
                <div className="p-12 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                  <CheckCircle className="h-8 w-8 text-cyan-400" />
                  <p className="font-bold text-zinc-300">All Match Scores Verified</p>
                  <p className="text-[11px] text-zinc-500">No pending disputed scores from players.</p>
                </div>
              ) : (
                disputedMatches.map((m) => (
                  <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-white">
                        Match #{m.match_no} (Round {m.round_no})
                      </p>
                      <p className="text-[11px] text-cyan-400 font-semibold">{m.tournamentTitle}</p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedTournamentId(m.tournament_id);
                        setActiveTab('tournaments');
                      }}
                      className="px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 font-semibold rounded-lg text-[10px] transition-colors cursor-pointer"
                    >
                      Resolve Scorecard
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Info Column */}
        <div className="space-y-6">
          
          {/* Quick tournament checklist */}
          <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-5 space-y-4 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Tournament Flow Checklist</h3>
            
            <div className="space-y-3">
              {[
                { step: '1', title: 'Deploy Tournament', desc: 'Create the arena, set prize pools and rules.' },
                { step: '2', title: 'Register Competitors', desc: 'Players sign up and are approved by you.' },
                { step: '3', title: 'Compile Matchmaking Bracket', desc: 'Auto-generates match schedules.' },
                { step: '4', title: 'Review & Crown Champions', desc: 'Verify score reports to advance the bracket.' }
              ].map(item => (
                <div key={item.step} className="flex gap-3 items-start text-xs">
                  <div className="h-5 w-5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-200">{item.title}</h4>
                    <p className="text-zinc-400 text-[10px] leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
