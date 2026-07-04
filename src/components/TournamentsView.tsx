import { useState, useEffect } from 'react';
import { 
  Trophy, Search, Filter, Calendar, Users, Award, Shield, 
  ChevronRight, ArrowLeft, Gamepad2, PlusCircle, CheckCircle, 
  HelpCircle, Eye, AlertCircle, Sparkles, Upload, MessageSquare, Coins, UserPlus
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  Tournament, Game, Profile, TournamentPlayer, Match, 
  TournamentStatus, TournamentFormat, PlayerRegistrationStatus, TournamentRosterCount
} from '../types';
import { db } from '../services/db';
import { useToast } from './Toast';
import { supabase, isSupabaseConfigured } from '../supabase';
import BracketTree from './BracketTree';
import ChatBox from './ChatBox';

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

interface TournamentsViewProps {
  currentUser: Profile;
  tournaments: Tournament[];
  games: Game[];
  profiles: Profile[];
  onRefreshTournaments: () => void;
  selectedTournamentId: string | null;
  setSelectedTournamentId: (id: string | null) => void;
}

export default function TournamentsView({
  currentUser,
  tournaments,
  games,
  profiles,
  onRefreshTournaments,
  selectedTournamentId,
  setSelectedTournamentId
}: TournamentsViewProps) {
  // Filter States
  const [search, setSearch] = useState('');
  const [selectedGameFilter, setSelectedGameFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [registrationForm, setRegistrationForm] = useState({ display_name: '', email: '', region: '', team_name: '', notes: '' });
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null);
  const [pendingPaymentRegistrationId, setPendingPaymentRegistrationId] = useState<string | null>(null);
  const [paymentReferenceInput, setPaymentReferenceInput] = useState('');
  const [quickDmRecipientId, setQuickDmRecipientId] = useState<string | null>(null);

  // Active Tournament Detail States
  const [registrations, setRegistrations] = useState<TournamentPlayer[]>([]);
  const [rosterCounts, setRosterCounts] = useState<TournamentRosterCount[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [detailTab, setDetailTab] = useState<'overview' | 'registrations' | 'bracket' | 'chat'>('overview');
  
  // Registration and Action Loading States
  const [registering, setRegistering] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Match Modal states
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [p1ReportScore, setP1ReportScore] = useState<number>(0);
  const [p2ReportScore, setP2ReportScore] = useState<number>(0);
  const [proofUrlInput, setProofUrlInput] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [hostForm, setHostForm] = useState({
    title: '',
    description: '',
    game_id: games[0]?.id || '',
    banner_url: '',
    max_players: '8',
    format: 'single_elimination' as TournamentFormat,
    prize_pool: '',
    rules: '',
    start_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    entry_fee: '0',
    payment_provider: 'none' as 'none' | 'paystack',
    registration_note: '',
    auto_lock_registration: true,
    points_only: false,
    slot_minutes: '90'
  });

  const toast = useToast();
  const [rescheduleTime, setRescheduleTime] = useState<string>('');
  const [showEmbedCode, setShowEmbedCode] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  const getSignupLink = (tournamentId: string) => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/?tournament=${tournamentId}&invite=1`;
  };

  const getEmbedCode = (tournamentId: string) => {
    if (typeof window === 'undefined') return '';
    const src = `${window.location.origin}/embed/tournament/${tournamentId}`;
    return `<iframe src="${src}" width="100%" height="700" style="border:0;min-height:450px;"></iframe>`;
  };

  const handleGenerateSchedule = async () => {
    if (!activeTournament) return;
    try {
      setActionLoading(true);
      const generated = await db.generateSchedule(activeTournament.id, { slot_minutes: 120 });
      if (generated.length === 0) {
        toast.show('All matches already have schedule slots.', 'info');
      } else {
        toast.show('Schedule generated for unscheduled matches.', 'success');
      }
      await loadTournamentDetails(activeTournament.id);
    } catch (err: any) {
      toast.show('Failed to generate schedule. Please try again.', 'error');
      console.error('generateSchedule error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRescheduleMatch = async () => {
    if (!selectedMatch) return;
    try {
      setActionLoading(true);
      const iso = rescheduleTime ? new Date(rescheduleTime).toISOString() : null;
      await db.rescheduleMatch(selectedMatch.id, iso);
      toast.show('Match rescheduled successfully.', 'success');
      await loadTournamentDetails(selectedMatch.tournament_id);
      setSelectedMatch(null);
    } catch (err: any) {
      toast.show('Could not reschedule match. Please try again.', 'error');
      console.error('rescheduleMatch error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMatch?.scheduled_time) {
      setRescheduleTime(formatLocalInputValue(selectedMatch.scheduled_time));
    } else {
      setRescheduleTime('');
    }
  }, [selectedMatch]);

  useEffect(() => {
    if (isUuid(selectedTournamentId)) {
      loadTournamentDetails(selectedTournamentId);
    } else {
      setRegistrations([]);
      setMatches([]);
    }
  }, [selectedTournamentId, tournaments]);

  useEffect(() => {
    if (!selectedTournamentId) {
      try {
        const params = new URLSearchParams(window.location.search);
        const tournamentParam = params.get('tournament') || params.get('t');
        if (tournamentParam && tournaments.some(t => t.id === tournamentParam)) {
          setSelectedTournamentId(tournamentParam);
          setDetailTab('overview');
        }
      } catch (e) {
        console.warn('Unable to parse URL params for tournament deep link.', e);
      }
    }
  }, [selectedTournamentId, tournaments, setSelectedTournamentId]);

  useEffect(() => {
    db.getRosterCounts()
      .then(setRosterCounts)
      .catch(err => console.error('Failed to load roster counts:', err));
  }, [tournaments]);

  useEffect(() => {
    if (games.length && !hostForm.game_id) {
      setHostForm(prev => ({ ...prev, game_id: games[0].id }));
    }
  }, [games, hostForm.game_id]);

  const loadTournamentDetails = async (tId: string) => {
    try {
      const [regsData, matchesData] = await Promise.all([
        db.getTournamentPlayers(tId),
        db.getMatches(tId)
      ]);
      setRegistrations(regsData);
      setMatches(matchesData);
      setRosterCounts(prev => {
        const next = prev.filter(item => item.tournament_id !== tId);
        next.push({
          tournament_id: tId,
          total: regsData.length,
          approved: regsData.filter(reg => reg.status === 'approved').length,
          pending: regsData.filter(reg => reg.status === 'pending').length
        });
        return next;
      });
    } catch (err) {
      console.error('Error loading tournament details:', err);
    }
  };

  // Filter logic
  const filteredTournaments = tournaments.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                          t.description.toLowerCase().includes(search.toLowerCase());
    const matchesGame = selectedGameFilter === 'all' || t.game_id === selectedGameFilter;
    const matchesStatus = selectedStatusFilter === 'all' || t.status === selectedStatusFilter;
    return matchesSearch && matchesGame && matchesStatus;
  });

  const activeTournament = tournaments.find(t => t.id === selectedTournamentId);
  const isRegistered = registrations.some(r => r.player_id === currentUser.id);
  const myRegistration = registrations.find(r => r.player_id === currentUser.id);
  const totalPages = Math.max(1, Math.ceil(filteredTournaments.length / itemsPerPage));
  const paginatedTournaments = filteredTournaments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedGameFilter, selectedStatusFilter, tournaments.length]);
  const activeRosterCount = activeTournament
    ? rosterCounts.find(count => count.tournament_id === activeTournament.id) || {
        tournament_id: activeTournament.id,
        total: registrations.length,
        approved: registrations.filter(reg => reg.status === 'approved').length,
        pending: registrations.filter(reg => reg.status === 'pending').length
      }
    : undefined;
  const activeApprovedCount = activeRosterCount?.approved || 0;
  const activePendingCount = activeRosterCount?.pending || 0;
  const activeReservedCount = activeApprovedCount + activePendingCount;
  const activeIsFull = Boolean(activeTournament && activeReservedCount >= activeTournament.max_players);
  const isActiveHost = Boolean(activeTournament && activeTournament.organizer_id === currentUser.id);
  const canManageActiveTournament = Boolean(activeTournament && (currentUser.role === 'admin' || isActiveHost));

  useEffect(() => {
    if (!activeTournament) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const invite = params.get('invite') || params.get('signup');
      const tournamentParam = params.get('tournament') || params.get('t');
      if (invite && tournamentParam === activeTournament.id && activeTournament.status === 'registration' && !isRegistered) {
        setShowRegistrationModal(true);
      }
    } catch (e) {
      console.warn('Unable to parse URL params for tournament invite.', e);
    }
  }, [activeTournament, selectedTournamentId, isRegistered]);

  const getProfileDisplayName = (profile?: Profile | null, fallback?: string) => {
    const candidate = profile?.username?.trim() || fallback?.trim();
    return candidate || 'Player';
  };

  const formatDateTime = (value?: string) => {
    if (!value) return 'TBD';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'TBD' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  };

  const formatLocalInputValue = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const tzOffsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
  };

  const approvedMembers = registrations.filter(reg => reg.status === 'approved' && reg.player_id !== currentUser.id);
  const currentUserMatch = [...matches]
    .filter(match => match.status !== 'completed' && (match.player1_id === currentUser.id || match.player2_id === currentUser.id))
    .sort((a, b) => a.round_no - b.round_no || a.match_no - b.match_no)[0];
  const upcomingMatch = currentUserMatch || [...matches]
    .filter(match => match.status !== 'completed')
    .sort((a, b) => a.round_no - b.round_no || a.match_no - b.match_no)[0];

  const openChatWithMember = (recipientId: string) => {
    setQuickDmRecipientId(recipientId);
    setDetailTab('chat');
  };

  const uploadProofToSupabase = async (file: File) => {
    if (!supabase || !isSupabaseConfigured) {
      throw new Error('Supabase storage is not configured. Please paste a public proof URL instead.');
    }

    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('proof-screenshots').upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

    if (error) throw error;

    const { data: publicData } = supabase.storage.from('proof-screenshots').getPublicUrl(fileName);
    return publicData.publicUrl;
  };

  const openRegistrationModal = () => {
    if (!selectedTournamentId) return;
    if (activeTournament?.organizer_id === currentUser.id) {
      setRegistrationMessage('The tournament host cannot join their own tournament as a competitor.');
      return;
    }
    if (activeIsFull) {
      setRegistrationMessage('This tournament is full.');
      return;
    }
    if (activeTournament?.status !== 'registration') {
      setRegistrationMessage('Registration is closed for this tournament.');
      return;
    }
    setShowRegistrationModal(true);
    setRegistrationMessage(null);
    setPendingPaymentRegistrationId(null);
    setPaymentReferenceInput('');
    setRegistrationForm({
      display_name: currentUser.username,
      email: currentUser.email,
      region: '',
      team_name: '',
      notes: ''
    });
  };

  const handleInvitePlayer = async (inviteeId: string) => {
    if (!selectedTournamentId || !activeTournament) return;
    setInvitingUserId(inviteeId);
    try {
      await db.inviteToTournament(activeTournament.id, currentUser.id, inviteeId);
      toast.show('Invite sent to the player.', 'success');
    } catch (err: any) {
      console.error('Invite failed:', err);
      toast.show('Could not send the invite. Please try again.', 'error');
    } finally {
      setInvitingUserId(null);
    }
  };

  const handleRegister = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedTournamentId) return;
    if (activeTournament?.organizer_id === currentUser.id) {
      setRegistrationMessage('The tournament host cannot join their own tournament as a competitor.');
      return;
    }
    if (activeIsFull) {
      setRegistrationMessage('This tournament is full.');
      return;
    }
    if (!registrationForm.region?.trim()) {
      setRegistrationMessage('Please enter your region or country before registering.');
      return;
    }
    setRegistering(true);
    try {
      const reg = await db.registerPlayer(selectedTournamentId, currentUser.id, registrationForm);
      await loadTournamentDetails(selectedTournamentId);
      onRefreshTournaments();
      if (activeTournament?.entry_fee && activeTournament.entry_fee > 0 && reg.payment_status === 'pending') {
        setPendingPaymentRegistrationId(reg.id);
        setRegistrationMessage('Your spot is reserved. Complete the entry fee to secure approval.');
      } else {
        setRegistrationMessage('You are in. Your tournament spot is confirmed.');
        setShowRegistrationModal(false);
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      toast.show('Registration failed. Please try again.', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!pendingPaymentRegistrationId) return;
    try {
      await db.submitPaymentReference(pendingPaymentRegistrationId, paymentReferenceInput);
      await loadTournamentDetails(selectedTournamentId!);
      onRefreshTournaments();
      setPendingPaymentRegistrationId(null);
      setPaymentReferenceInput('');
      setRegistrationMessage('Payment reference submitted. The host will verify it before approval.');
      setShowRegistrationModal(false);
    } catch (err: any) {
      console.error('Payment reference submission failed:', err);
      toast.show('Payment reference submission failed. Please try again.', 'error');
    }
  };

  const handleApprovePayment = async (regId: string, reference?: string) => {
    setActionLoading(true);
    try {
      await db.markRegistrationPaid(regId, reference || '');
      if (selectedTournamentId) await loadTournamentDetails(selectedTournamentId);
      onRefreshTournaments();
    } catch (err: any) {
      console.error('Payment approval failed:', err);
      toast.show('Payment approval failed. Please try again.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemovePlayer = async (regId: string, disqualify = false) => {
    const reason = window.prompt(disqualify ? 'Reason for disqualification:' : 'Reason for removing this player:');
    if (reason === null) return;
    setActionLoading(true);
    try {
      await db.removeTournamentPlayer(regId, reason, disqualify);
      if (selectedTournamentId) await loadTournamentDetails(selectedTournamentId);
      onRefreshTournaments();
    } catch (err: any) {
      console.error('Player action failed:', err);
      toast.show('Player action failed. Please try again.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Organizer: Approve player registration
  const handleApprovePlayer = async (regId: string, status: PlayerRegistrationStatus) => {
    setActionLoading(true);
    try {
      await db.approvePlayer(regId, status);
      onRefreshTournaments();
      if (selectedTournamentId) {
        await loadTournamentDetails(selectedTournamentId);
      }
    } catch (err: any) {
      console.error('Tournament action failed:', err);
      toast.show('Action failed. Please try again.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Organizer: Generate Bracket
  const handleGenerateBracket = async () => {
    if (!selectedTournamentId) return;
    setActionLoading(true);
    try {
      await db.generateBracket(selectedTournamentId);
      onRefreshTournaments();
      await loadTournamentDetails(selectedTournamentId);
      setDetailTab('bracket');
    } catch (err: any) {
      toast.show('Generating bracket failed. Please check organizer access and try again.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Player: Submit Match Scorecard
  const handleSubmitScore = async (e: any) => {
    e.preventDefault();
    if (!selectedMatch) return;
    setSubmittingScore(true);
    try {
      let finalProof = proofUrlInput.trim();
      if (proofFile) {
        finalProof = await uploadProofToSupabase(proofFile);
      } else if (!finalProof) {
        finalProof = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600';
      }

      await db.submitMatchResult(
        selectedMatch.id,
        p1ReportScore,
        p2ReportScore,
        finalProof,
        currentUser.id
      );
      onRefreshTournaments();
      if (selectedTournamentId) {
        await loadTournamentDetails(selectedTournamentId);
      }
      setSelectedMatch(null);
      setProofFile(null);
      setProofUrlInput('');
      toast.show('Scorecard report submitted successfully. Waiting for organizer approval!', 'success');
    } catch (err: any) {
      console.error('Score report failed:', err);
      toast.show('Score report failed. Please try again.', 'error');
    } finally {
      setSubmittingScore(false);
    }
  };

  // Organizer/Admin: Verify and advance players
  const handleVerifyResult = async (matchId: string, winnerId: string, p1S: number, p2S: number) => {
    setActionLoading(true);
    try {
      const updatedMatch = await db.verifyMatchResult(matchId, winnerId, p1S, p2S);
      onRefreshTournaments();
      if (selectedTournamentId) {
        await loadTournamentDetails(selectedTournamentId);
      }
      
      // If no next_match_id exists, this was the Grand Finals! Crown champion!
      if (!updatedMatch.next_match_id) {
        confetti({
          particleCount: 180,
          spread: 90,
          origin: { y: 0.55 }
        });
      }

      setSelectedMatch(null);
    } catch (err: any) {
      console.error('Verification failed:', err);
      toast.show('Verification failed. Please try again.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getGameName = (id: string) => games.find(g => g.id === id)?.name || 'Esports Match';
  const getDisplayName = (profile?: Profile) => profile?.username || 'Unknown Competitor';
  const getDisplayEmail = (profile?: Profile) => profile?.show_email ? profile.email : 'Hidden by privacy';
  const inviteTargets = (activeTournament ? profiles.filter((profile) => {
    if (profile.id === currentUser.id || profile.id === activeTournament.organizer_id) return false;
    return !registrations.some((reg) => reg.player_id === profile.id);
  }) : []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* RENDER LIST OF TOURNAMENTS */}
      {!selectedTournamentId ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-850/60 pb-5">
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Browse Tournaments</h1>
              <p className="text-sm text-gray-400">Join regional tournament series, view status, and climb ranks.</p>
            </div>
            
            {/* Create Tournament quick trigger for organizers */}
            {(currentUser.role === 'organizer' || currentUser.role === 'admin') && (
              <button 
                onClick={() => setSelectedTournamentId('new')}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg text-sm transition-transform hover:scale-103 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.4)]"
              >
                <PlusCircle className="h-4 w-4" />
                Host Tournament
              </button>
            )}
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search tournaments by game, title, prize pool..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <select
              value={selectedGameFilter}
              onChange={(e) => setSelectedGameFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="all">🎮 All Games</option>
              {games.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="all">🏆 All Statuses</option>
              <option value="draft">Drafts</option>
              <option value="registration">Registration Open</option>
              <option value="active">Active Brackets</option>
              <option value="completed">Concluded</option>
            </select>
          </div>

          {/* Tournaments Grid */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-500">
              <span>{filteredTournaments.length} tournament{filteredTournaments.length === 1 ? '' : 's'} found</span>
              <span>Page {currentPage} of {totalPages}</span>
            </div>
            {filteredTournaments.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 text-center text-slate-600 shadow-sm">
                No tournaments match your filters right now. Try clearing the search or selecting a different game.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {paginatedTournaments.map(t => {
                  const game = games.find(g => g.id === t.game_id);
                  const count = rosterCounts.find(item => item.tournament_id === t.id);
                  const approvedCount = count?.approved || 0;
                  const pendingCount = count?.pending || 0;
                  const reservedCount = approvedCount + pendingCount;
                  const isFull = reservedCount >= t.max_players;
                  const isHost = t.organizer_id === currentUser.id;

                  return (
                    <div 
                      key={t.id}
                      onClick={() => setSelectedTournamentId(t.id)}
                      className="group flex flex-col h-full rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
                    >
                      <div className="h-40 overflow-hidden rounded-t-3xl bg-slate-100">
                        <img 
                          src={t.banner_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800'} 
                          alt={t.title}
                          className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                        <div className="space-y-2">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-600">
                            {game?.name || 'Multi-platform'}
                          </span>
                          <h3 className="text-base font-semibold text-slate-950 leading-snug line-clamp-2">{t.title}</h3>
                          <p className="text-sm text-slate-600 line-clamp-2">{t.description}</p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-3 border-t border-slate-200 text-sm text-slate-500">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-slate-400" />
                            <span>{reservedCount}/{t.max_players}</span>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            <Trophy className="h-3.5 w-3.5 text-cyan-600" />
                            <span>{t.prize_pool || '$500 USD'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredTournaments.length > itemsPerPage && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white/90 p-3 text-sm text-slate-600 shadow-sm">
                <span>Showing {paginatedTournaments.length} of {filteredTournaments.length} available tournaments</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : selectedTournamentId === 'new' ? (
        
        // CREATE NEW TOURNAMENT INTERFACE (ORGANIZER ONLY)
        <div className="max-w-2xl mx-auto space-y-6">
          <button 
            onClick={() => setSelectedTournamentId(null)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Browse
          </button>

          <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-6 space-y-6 shadow-2xl backdrop-blur-md">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-cyan-400" />
                Host Custom Tournament
              </h2>
              <p className="text-xs text-gray-400 mt-1">Configure your game titles, bracket sizes, entry fees, and points-only rewards.</p>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const title = hostForm.title.trim();
              const description = hostForm.description.trim();
              const game_id = hostForm.game_id;
              const banner_url = hostForm.banner_url.trim();
              const max_players = Number(hostForm.max_players);
              const format = hostForm.format;
              const prize_pool = hostForm.prize_pool.trim();
              const rules = hostForm.rules.trim();
              const start_time = hostForm.start_time;
              const entry_fee = Number(hostForm.entry_fee || 0);
              const payment_provider = hostForm.payment_provider || 'none';
              const registration_note = hostForm.registration_note.trim();
              const auto_lock_registration = hostForm.auto_lock_registration;
              const points_only = hostForm.points_only;
              const slot_minutes = Number(hostForm.slot_minutes || 90);

              if (!title || !description || !game_id || !start_time) {
                toast.show('Please fill out all required fields.', 'error');
                return;
              }

              setActionLoading(true);
              try {
                const created = await db.createTournament({
                  title,
                  description,
                  game_id,
                  banner_url: banner_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
                  max_players,
                  status: 'registration',
                  start_time: new Date(start_time).toISOString(),
                  format,
                  prize_pool,
                  rules,
                  entry_fee,
                  payment_provider,
                  slot_minutes,
                  registration_note,
                  auto_lock_registration,
                  points_only
                });
                onRefreshTournaments();
                setSelectedTournamentId(created.id);
              } catch (err: any) {
                console.error('Host tournament failed:', err);
                toast.show('Host tournament failed. Please try again.', 'error');
              } finally {
                setActionLoading(false);
              }
            }} className="space-y-4 text-left">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Tournament Title *</label>
                  <input required value={hostForm.title} onChange={(e) => setHostForm({ ...hostForm, title: e.target.value })} name="title" type="text" placeholder="e.g. eFootball Sunday Clash" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Esports Game *</label>
                  <select name="game_id" value={hostForm.game_id} onChange={(e) => setHostForm({ ...hostForm, game_id: e.target.value })} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50" disabled={games.length === 0}>
                    {games.length === 0 ? (
                      <option value="" disabled>No games loaded - refresh after Supabase sync</option>
                    ) : (
                      games.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))
                    )}
                  </select>
                  {games.length === 0 && (
                    <p className="text-[11px] text-amber-300">The game list is empty, so tournament hosting is paused until games load.</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Description Summary *</label>
                <textarea required value={hostForm.description} onChange={(e) => setHostForm({ ...hostForm, description: e.target.value })} name="description" rows={2} placeholder="Write high-level introduction of the tournament bracket..." className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Banner Image URL</label>
                  <input value={hostForm.banner_url} onChange={(e) => setHostForm({ ...hostForm, banner_url: e.target.value })} name="banner_url" type="url" placeholder="e.g. https://images.unsplash.com/..." className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Launch Start Time *</label>
                  <input required value={hostForm.start_time} onChange={(e) => setHostForm({ ...hostForm, start_time: e.target.value })} name="start_time" type="datetime-local" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Bracket Size *</label>
                  <select name="max_players" value={hostForm.max_players} onChange={(e) => setHostForm({ ...hostForm, max_players: e.target.value })} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50">
                    <option value="4">4 Players</option>
                    <option value="8">8 Players</option>
                    <option value="16">16 Players</option>
                    <option value="32">32 Players</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Tournament Format</label>
                  <select name="format" value={hostForm.format} onChange={(e) => setHostForm({ ...hostForm, format: e.target.value as TournamentFormat })} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50">
                    <option value="single_elimination">Single Elimination</option>
                    <option value="double_elimination">Double Elimination</option>
                    <option value="round_robin">Round Robin</option>
                    <option value="group_stage">Group Stage</option>
                    <option value="league">League</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Prize Pool / Award</label>
                  <input value={hostForm.prize_pool} onChange={(e) => setHostForm({ ...hostForm, prize_pool: e.target.value })} name="prize_pool" type="text" placeholder="Optional; e.g. $1,000 USD + Badges" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Entry Fee (USD)</label>
                  <input value={hostForm.entry_fee} onChange={(e) => setHostForm({ ...hostForm, entry_fee: e.target.value })} name="entry_fee" type="number" min="0" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Match Length (minutes)</label>
                  <input value={hostForm.slot_minutes} onChange={(e) => setHostForm({ ...hostForm, slot_minutes: e.target.value })} name="slot_minutes" type="number" min="15" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Payment Provider</label>
                  <select name="payment_provider" value={hostForm.payment_provider} onChange={(e) => setHostForm({ ...hostForm, payment_provider: e.target.value as 'none' | 'paystack' })} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50">
                    <option value="none">No payment</option>
                    <option value="paystack">Paystack-ready</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center gap-2 rounded-xl border border-white/5 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-300">
                  <input checked={hostForm.points_only} onChange={(e) => setHostForm({ ...hostForm, points_only: e.target.checked })} name="points_only" type="checkbox" className="h-4 w-4 rounded border-white/10 bg-transparent" />
                  Points-only tournament (no prize pool needed)
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-white/5 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-300">
                  <input checked={hostForm.auto_lock_registration} onChange={(e) => setHostForm({ ...hostForm, auto_lock_registration: e.target.checked })} name="auto_lock_registration" type="checkbox" className="h-4 w-4 rounded border-white/10 bg-transparent" />
                  Auto-lock registration on start
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Registration Note</label>
                <input value={hostForm.registration_note} onChange={(e) => setHostForm({ ...hostForm, registration_note: e.target.value })} name="registration_note" type="text" placeholder="Optional message for players" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Tournament Rules & Guidelines</label>
                <textarea value={hostForm.rules} onChange={(e) => setHostForm({ ...hostForm, rules: e.target.value })} name="rules" rows={3} placeholder="1. Match play duration is 10 min.&#10;2. Submit screenshots of final match scores scorecard within 15 min." className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50" />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setSelectedTournamentId(null)} className="px-4 py-2 border border-white/10 text-xs font-semibold rounded-xl text-zinc-300 hover:bg-white/5 transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-xl text-xs shadow-lg shadow-cyan-500/10 transition-colors cursor-pointer disabled:opacity-50">
                  {actionLoading ? 'Launching...' : 'Deploy Tournament'}
                </button>
              </div>

            </form>
          </div>
        </div>

      ) : (

        // TOURNAMENT DETAIL INTERFACE
        <div className="space-y-6">
          
          {/* Back Trigger */}
          <button 
            onClick={() => setSelectedTournamentId(null)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Tournaments
          </button>

          {/* Banner Hero */}
          {activeTournament && (
            <div className="rounded-2xl border border-gray-800 bg-[#161920] overflow-hidden shadow-2xl">
              <div className="h-56 relative">
                <img 
                  src={activeTournament.banner_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200'} 
                  alt={activeTournament.title} 
                  className="w-full h-full object-cover opacity-80"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-linear-to-t from-[#161920] via-[#161920]/40 to-transparent" />
                
                {/* Title badge */}
                <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="space-y-1 text-left">
                    <p className="text-xs font-extrabold uppercase tracking-widest text-cyan-400">
                      {getGameName(activeTournament.game_id)}
                    </p>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
                      {activeTournament.title}
                    </h1>
                    {activeTournament.status === 'completed' && activeTournament.winner_id && (
                      <div className="mt-2 flex items-center gap-3">
                        <img
                          src={profiles.find(p => p.id === activeTournament.winner_id)?.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${profiles.find(p => p.id === activeTournament.winner_id)?.username}`}
                          alt="winner"
                          className="h-10 w-10 rounded-full object-cover border border-white/10"
                        />
                        <div className="text-sm">
                          <div className="text-xs text-purple-300 font-semibold">Game finished</div>
                          <div className="text-white font-bold">{getProfileDisplayName(profiles.find(p => p.id === activeTournament.winner_id), 'Winner')}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Join / Status Button */}
                  <div className="space-y-3">
                    {activeTournament.status === 'registration' && (
                      isRegistered ? (
                        <div className="flex items-center gap-1 px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                          <CheckCircle className="h-4 w-4" />
                          Joined ({myRegistration?.status || 'Pending'})
                        </div>
                      ) : activeIsFull ? (
                        <div className="flex items-center gap-1 px-4 py-2 bg-red-500/10 text-red-300 border border-red-500/25 rounded-xl text-xs font-bold">
                          <AlertCircle className="h-4 w-4" />
                          Tournament Full
                        </div>
                      ) : (
                        <button
                          id="register-button"
                          onClick={openRegistrationModal}
                          disabled={registering}
                          className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-semibold rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition-all hover:scale-103 cursor-pointer"
                        >
                          {registering ? 'Joining...' : 'Register as Competitor'}
                        </button>
                      )
                    )}

                    {activeTournament.status === 'active' && (
                      <div className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/25 rounded-xl text-xs font-extrabold uppercase tracking-wider">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        In Play Bracket
                      </div>
                    )}

                    {activeTournament.status === 'completed' && (
                      <div className="flex items-center gap-1.5 px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl text-xs font-extrabold uppercase tracking-wider">
                        Concluded Tournament
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const link = getSignupLink(activeTournament.id);
                          navigator.clipboard?.writeText(link);
                          toast.show('Signup link copied to clipboard', 'success');
                        }}
                        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white hover:bg-white/10"
                      >
                        Copy signup link
                      </button>

                      {canManageActiveTournament && activeTournament.status === 'registration' && (
                        <button
                          type="button"
                          onClick={handleGenerateSchedule}
                          disabled={actionLoading}
                          className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Generate schedule
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowEmbedCode((prev) => !prev)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white hover:bg-white/10"
                      >
                        {showEmbedCode ? 'Hide embed code' : 'Embed bracket'}
                      </button>
                    </div>

                    {showEmbedCode && (
                      <textarea
                        readOnly
                        value={getEmbedCode(activeTournament.id)}
                          className="mt-2 w-full min-h-22.5 rounded-2xl border border-white/10 bg-black/80 p-3 text-[11px] text-white"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Stat panel */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 p-5 border-t border-gray-850/60 bg-[#0F1115]/80 text-left">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Reward</span>
                  <p className="text-sm font-bold text-white">{activeTournament.points_only ? 'Points only' : activeTournament.prize_pool || '$500 USD'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Bracket Size</span>
                  <p className="text-sm font-bold text-white">{activeReservedCount}/{activeTournament.max_players} Slots</p>
                  {activePendingCount > 0 && (
                    <p className="text-[10px] text-amber-300">{activePendingCount} pending</p>
                  )}
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Format</span>
                  <p className="text-sm font-bold text-white capitalize">{activeTournament.format.replace('_', ' ')}</p>
                </div>
                <div className="hidden sm:block space-y-0.5">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Start Time</span>
                  <p className="text-sm font-bold text-white truncate">
                    {new Date(activeTournament.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tabs header */}
          <div className="flex border-b border-gray-850/60">
            {[
              { id: 'overview', name: 'Rules & Guidelines' },
              { id: 'registrations', name: `Competitors (${registrations.length})` },
              { id: 'bracket', name: 'Tournament Bracket' },
              { id: 'chat', name: 'Tournament Chat' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDetailTab(tab.id as any)}
                className={`px-5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  detailTab === tab.id 
                    ? 'border-cyan-500 text-cyan-400' 
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          {/* Tabs Body */}
          <div className="p-1">
            
            {/* OVERVIEW TAB */}
            {detailTab === 'overview' && activeTournament && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div className="md:col-span-2 space-y-6">
                  <div className="rounded-xl border border-gray-800/80 bg-[#161920]/40 p-5 space-y-3">
                    <h3 className="font-bold text-white text-sm">Rules & Match Regulations</h3>
                    <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">
                      {activeTournament.rules || 'No custom rules uploaded. Matches follow standard regional esports code of conduct.'}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {activeTournament.points_only && <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-300">Points-only rewards</span>}
                      {activeTournament.entry_fee && activeTournament.entry_fee > 0 ? <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">Entry fee: ${activeTournament.entry_fee}</span> : <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">Free to join</span>}
                    </div>
                    {activeTournament.status === 'registration' && (
                      <button
                        type="button"
                        onClick={() => setShowInviteModal(true)}
                        className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Invite players
                      </button>
                    )}
                  </div>

                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-white text-sm">Members & Match Rhythm</h3>
                        <p className="text-[11px] text-cyan-200/80">Keep the tournament moving with quick contact and clear timing.</p>
                      </div>
                      <span className="rounded-full border border-cyan-500/20 bg-[#08131a] px-2.5 py-1 text-[10px] font-semibold text-cyan-300">{approvedMembers.length} ready</span>
                    </div>

                    {upcomingMatch && (
                      <div className="rounded-2xl border border-white/10 bg-[#0f141b]/80 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-400">Next match</p>
                            <p className="text-sm font-semibold text-white">
                              {(() => {
                                const opponentId = currentUser.id === upcomingMatch.player1_id ? upcomingMatch.player2_id : upcomingMatch.player1_id;
                                const opponentProfile = profiles.find(profile => profile.id === opponentId);
                                return currentUserMatch
                                  ? `You vs ${getProfileDisplayName(opponentProfile)}`
                                  : `${getProfileDisplayName(profiles.find(profile => profile.id === upcomingMatch.player1_id), 'TBD')} vs ${getProfileDisplayName(profiles.find(profile => profile.id === upcomingMatch.player2_id), 'TBD')}`;
                              })()}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {upcomingMatch.scheduled_time ? `Scheduled ${formatDateTime(upcomingMatch.scheduled_time)}` : 'No time set yet — use chat to coordinate'}
                            </p>
                          </div>
                          {(() => {
                            const opponentId = currentUser.id === upcomingMatch.player1_id ? upcomingMatch.player2_id : upcomingMatch.player1_id;
                            return opponentId ? (
                              <button onClick={() => openChatWithMember(opponentId)} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20">
                                DM opponent
                              </button>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {approvedMembers.length === 0 ? (
                        <p className="text-xs text-zinc-400">Approved members will appear here when the roster is locked in.</p>
                      ) : (
                        approvedMembers.slice(0, 5).map((reg) => {
                          const profile = profiles.find((item) => item.id === reg.player_id);
                          return (
                            <button
                              key={reg.id}
                              onClick={() => openChatWithMember(reg.player_id)}
                              className="rounded-full border border-white/10 bg-[#0b1117] px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition-colors hover:border-cyan-500/40 hover:text-cyan-300"
                            >
                              {getProfileDisplayName(profile, reg.display_name)}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Host info card */}
                  <div className="rounded-xl border border-gray-800/80 bg-[#161920]/40 p-5 space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tournament Host</h3>
                    <div className="flex items-center gap-3">
                      {(() => {
                        const hostProfile = profiles.find(p => p.id === activeTournament.organizer_id);
                        return (
                          <>
                      <img 
                        src={hostProfile?.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${activeTournament.organizer_id}`} 
                        className="h-9 w-9 rounded bg-gray-900"
                        alt=""
                      />
                      <div>
                        <p className="text-xs font-bold text-white">{hostProfile?.username || 'Tournament host'}</p>
                        <p className="text-[10px] text-amber-400 font-medium">Host</p>
                      </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Organizer Quick Actions widget */}
                  {canManageActiveTournament && activeTournament.status === 'registration' && (
                    <div className="rounded-xl border border-dashed border-cyan-500/20 bg-cyan-500/5 p-5 space-y-3 shadow-[0_0_15px_rgba(6,182,212,0.03)]">
                      <h3 className="text-xs font-extrabold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5" />
                        Organizer Actions
                      </h3>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Approve registrations inside the Competitors tab. When registration is complete, compile the bracket structure to start matches.
                      </p>
                      <button
                        onClick={handleGenerateBracket}
                        disabled={actionLoading || activeApprovedCount < 2}
                        className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-500 text-black font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        {actionLoading ? 'Generating...' : 'Compile & Start Bracket'}
                      </button>
                      {activeApprovedCount < 2 && (
                        <span className="text-[10px] text-yellow-500/80 block text-center">At least 2 approved players required</span>
                      )}
                      {activeIsFull && matches.length === 0 && (
                        <span className="text-[10px] text-cyan-300 block text-center">Capacity reached. The bracket will compile automatically.</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* REGISTRATIONS TAB */}
            {detailTab === 'registrations' && activeTournament && (
              <div className="rounded-xl border border-gray-800/85 bg-[#161920]/30 overflow-hidden text-left">
                <div className="p-4 border-b border-gray-850/60 bg-[#161920]/50 flex items-center justify-between">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">Registered Competitors List</h3>
                  <span className="text-xs text-gray-400">{registrations.length} total signups</span>
                </div>

                <div className="divide-y divide-gray-850/60">
                  {registrations.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-500">No players registered yet. Join the arena first!</div>
                  ) : (
                    registrations.map(reg => {
                      const profile = profiles.find(p => p.id === reg.player_id);
                      const isMe = reg.player_id === currentUser.id;

                      return (
                        <div key={reg.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={profile?.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + reg.player_id} 
                              alt="" 
                              className="h-8 w-8 rounded bg-gray-800 object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <p className="text-xs font-bold text-gray-200">
                                {getProfileDisplayName(profile)}
                                {isMe && <span className="ml-1.5 text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded-full font-semibold">You</span>}
                                {activeTournament.organizer_id === reg.player_id && <span className="ml-1.5 text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded-full font-semibold">Host</span>}
                              </p>
                              <p className="text-[10px] text-gray-500 truncate">{getDisplayEmail(profile)}</p>
                              {reg.payment_reference && (
                                <p className="text-[10px] text-amber-300 truncate">Payment ref: {reg.payment_reference}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 justify-end">
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                              reg.status === 'approved' 
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
                                : reg.status === 'pending'
                                ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {reg.status}
                            </span>
                            {reg.payment_status && reg.payment_status !== 'free' && (
                              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                reg.payment_status === 'paid'
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                              }`}>
                                {reg.payment_status}
                              </span>
                            )}

                            {/* Approval buttons for organizers/admins */}
                            {reg.player_id !== currentUser.id && (
                              <button
                                onClick={() => openChatWithMember(reg.player_id)}
                                className="px-2.5 py-1 bg-white/5 hover:bg-cyan-500/10 text-zinc-300 font-semibold rounded-lg text-[10px] border border-white/10 transition-colors cursor-pointer"
                              >
                                DM
                              </button>
                            )}

                            {canManageActiveTournament && reg.status === 'pending' && (
                              <div className="flex items-center gap-1.5">
                                {activeTournament.entry_fee && activeTournament.entry_fee > 0 ? (
                                  <button
                                    onClick={() => handleApprovePayment(reg.id, reg.payment_reference)}
                                    disabled={actionLoading || !reg.payment_reference}
                                    className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-semibold rounded-lg text-[10px] transition-colors cursor-pointer"
                                  >
                                    Verify Pay
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleApprovePlayer(reg.id, 'approved')}
                                    disabled={actionLoading}
                                    className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg text-[10px] transition-colors cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                )}
                                <button
                                  onClick={() => handleApprovePlayer(reg.id, 'rejected')}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold rounded-lg text-[10px] border border-red-500/20 transition-colors cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                            {canManageActiveTournament && reg.status === 'approved' && activeTournament.status !== 'completed' && reg.player_id !== activeTournament.organizer_id && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleRemovePlayer(reg.id, activeTournament.status === 'active')}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-300 font-semibold rounded-lg text-[10px] border border-red-500/20 transition-colors cursor-pointer"
                                >
                                  {activeTournament.status === 'active' ? 'DQ' : 'Remove'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* BRACKET TAB */}
            {detailTab === 'bracket' && activeTournament && (
              <div className="space-y-4">
                {matches.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-800 p-12 text-center space-y-3">
                    <Trophy className="h-8 w-8 text-gray-600 mx-auto" />
                    <h4 className="text-sm font-bold text-gray-300">Bracket has not been compiled yet</h4>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      {canManageActiveTournament 
                        ? 'Approve pending players in the "Competitors" tab and click "Compile & Start Bracket" to launch tournament matches.' 
                        : 'The organizer will compile the matchmaking bracket as soon as player registration concludes.'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 text-left">
                    <p className="text-[11px] text-gray-400 mb-4 bg-gray-950/20 border border-gray-850 p-3 rounded-lg">
                      💡 <strong>How to Play:</strong> Click on any match card below to see scheduling, report scores, or verify match results as an organizer.
                    </p>
                    {upcomingMatch && (
                      <div className="mb-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-left">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-400">Match clock</p>
                            <p className="text-sm font-semibold text-white">
                              {(() => {
                                const opponentId = currentUser.id === upcomingMatch.player1_id ? upcomingMatch.player2_id : upcomingMatch.player1_id;
                                const opponentProfile = profiles.find(profile => profile.id === opponentId);
                                return currentUserMatch
                                  ? `You vs ${getProfileDisplayName(opponentProfile)}`
                                  : `${getProfileDisplayName(profiles.find(profile => profile.id === upcomingMatch.player1_id), 'TBD')} vs ${getProfileDisplayName(profiles.find(profile => profile.id === upcomingMatch.player2_id), 'TBD')}`;
                              })()}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {upcomingMatch.scheduled_time ? `Scheduled ${formatDateTime(upcomingMatch.scheduled_time)}` : 'Set a time, then DM your opponent'}
                            </p>
                          </div>
                          {(() => {
                            const opponentId = currentUser.id === upcomingMatch.player1_id ? upcomingMatch.player2_id : upcomingMatch.player1_id;
                            return opponentId ? (
                              <button onClick={() => openChatWithMember(opponentId)} className="rounded-full border border-cyan-500/30 bg-[#09131a] px-3 py-1.5 text-[11px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20">
                                DM next opponent
                              </button>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    )}
                    <BracketTree 
                      matches={matches} 
                      profiles={profiles} 
                      currentUser={currentUser} 
                      onMatchSelect={(m) => {
                        setSelectedMatch(m);
                        setP1ReportScore(m.player1_score || 0);
                        setP2ReportScore(m.player2_score || 0);
                        setProofUrlInput('');
                      }} 
                    />
                  </div>
                )}
              </div>
            )}

            {/* CHAT TAB */}
            {detailTab === 'chat' && activeTournament && (
              <div className="space-y-4">
                <ChatBox 
                  currentUser={currentUser} 
                  tournamentId={activeTournament.id}
                  profiles={profiles}
                  hostId={activeTournament.organizer_id}
                  defaultRecipientId={quickDmRecipientId || activeTournament.organizer_id}
                  allowedRecipientIds={[
                    activeTournament.organizer_id,
                    ...registrations.filter((reg) => reg.status === 'approved').map((reg) => reg.player_id)
                  ]}
                  simpleMode={true}
                  title="Tournament Chat" 
                />
              </div>
            )}

          </div>

        </div>
      )}

      {showInviteModal && activeTournament && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0e1218]/95 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-400">Invite players</p>
                <h3 className="text-lg font-semibold text-white">{activeTournament.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">Send an in-app invite so they can jump straight into registration.</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="text-sm text-zinc-500">✕</button>
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {inviteTargets.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-zinc-400">No eligible players are available to invite right now.</p>
              ) : (
                inviteTargets.map((profile) => (
                  <div key={profile.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                    <div className="flex items-center gap-3">
                      <img src={profile.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${profile.username}`} alt="" className="h-9 w-9 rounded-lg bg-zinc-900 object-cover" />
                      <div>
                        <p className="text-sm font-semibold text-white">{profile.username}</p>
                        <p className="text-[11px] text-zinc-500">{profile.role}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInvitePlayer(profile.id)}
                      disabled={invitingUserId === profile.id}
                      className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20 disabled:opacity-50"
                    >
                      {invitingUserId === profile.id ? 'Sending...' : 'Invite'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showRegistrationModal && activeTournament && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0e1218]/95 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-400">Join the arena</p>
                <h3 className="text-lg font-semibold text-white">{activeTournament.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">Share your details, join the bracket, and pay the entry fee if required.</p>
              </div>
              <button onClick={() => setShowRegistrationModal(false)} className="text-sm text-zinc-500">✕</button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4 text-left">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">Display name</label>
                  <input value={registrationForm.display_name} onChange={(e) => setRegistrationForm({ ...registrationForm, display_name: e.target.value })} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">Email</label>
                  <input type="email" value={registrationForm.email} onChange={(e) => setRegistrationForm({ ...registrationForm, email: e.target.value })} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">Region / Country</label>
                  <input
                    required
                    list="region-options"
                    value={registrationForm.region}
                    onChange={(e) => setRegistrationForm({ ...registrationForm, region: e.target.value })}
                    placeholder="e.g. USA, Brazil, Nigeria"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  />
                  <datalist id="region-options">
                    <option value="North America" />
                    <option value="South America" />
                    <option value="Europe" />
                    <option value="Africa" />
                    <option value="Asia" />
                    <option value="Oceania" />
                    <option value="United States" />
                    <option value="Canada" />
                    <option value="United Kingdom" />
                    <option value="Brazil" />
                    <option value="Nigeria" />
                    <option value="India" />
                    <option value="Australia" />
                  </datalist>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">Team / Tag</label>
                  <input value={registrationForm.team_name} onChange={(e) => setRegistrationForm({ ...registrationForm, team_name: e.target.value })} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">Notes for the host</label>
                <textarea rows={3} value={registrationForm.notes} onChange={(e) => setRegistrationForm({ ...registrationForm, notes: e.target.value })} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Tell the organizer your preferred setup, seed, or availability." />
              </div>

              <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/8 p-3 text-sm text-zinc-300">
                <div className="flex items-center justify-between gap-3">
                  <span>Entry fee</span>
                  <span className="font-semibold text-white">{activeTournament.entry_fee && activeTournament.entry_fee > 0 ? `$${activeTournament.entry_fee}` : 'Free'}</span>
                </div>
                <p className="mt-2 text-xs text-zinc-400">{activeTournament.entry_fee && activeTournament.entry_fee > 0 ? 'Submit your provider reference only after paying through the host-approved channel. The host must verify it before your slot is approved.' : 'Free sign-up is instant and your bracket spot is confirmed.'}</p>
              </div>

              {registrationMessage && <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">{registrationMessage}</div>}

              {pendingPaymentRegistrationId && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-2 text-sm text-zinc-200">Submit your payment reference for host review.</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input value={paymentReferenceInput} onChange={(e) => setPaymentReferenceInput(e.target.value)} placeholder="Payment reference" className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" />
                    <button type="button" onClick={handleConfirmPayment} className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-black">Submit ref</button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowRegistrationModal(false)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300">Cancel</button>
                <button type="submit" disabled={registering || activeIsFull} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{activeIsFull ? 'Tournament full' : registering ? 'Joining...' : activeTournament.entry_fee && activeTournament.entry_fee > 0 ? 'Join & pay' : 'Join for free'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MATCH PLAY DIALOG / DETAIL MODAL */}
      {selectedMatch && activeTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#161920] p-6 shadow-2xl relative text-left animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-extrabold uppercase tracking-widest">
                  Round {selectedMatch.round_no} - Match {selectedMatch.match_no}
                </span>
                <h3 className="text-base font-bold text-white mt-1">Match Scorecard Report</h3>
              </div>
              <button 
                onClick={() => setSelectedMatch(null)}
                className="text-gray-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Score layout */}
            <div className="grid grid-cols-5 gap-3 items-center py-4 px-3 bg-gray-900/60 rounded-xl mb-4 border border-gray-850/50">
              <div className="col-span-2 text-center space-y-1">
                <img 
                  src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${selectedMatch.player1_id || 'p1'}`} 
                  alt="" 
                  className="h-10 w-10 mx-auto rounded-lg bg-gray-950"
                />
                <span className="text-xs font-bold text-gray-200 block truncate">{games.find(g => {} /* query */) && ''}{profiles.find(p => p.id === selectedMatch.player1_id)?.username || 'TBD'}</span>
                <span className="text-[10px] text-gray-500 block">Player 1</span>
              </div>

              <div className="text-center font-extrabold text-gray-600 text-sm">VS</div>

              <div className="col-span-2 text-center space-y-1">
                <img 
                  src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${selectedMatch.player2_id || 'p2'}`} 
                  alt="" 
                  className="h-10 w-10 mx-auto rounded-lg bg-gray-950"
                />
                <span className="text-xs font-bold text-gray-200 block truncate">{profiles.find(p => p.id === selectedMatch.player2_id)?.username || 'TBD'}</span>
                <span className="text-[10px] text-gray-500 block">Player 2</span>
              </div>
            </div>

            {/* Match info body */}
            <div className="space-y-4">
              <div className="text-xs space-y-1.5 text-gray-400">
                <p>Status: <span className="text-white capitalize font-bold">{selectedMatch.status}</span></p>
                {selectedMatch.scheduled_time && (
                  <p>Scheduled: <span className="text-white font-semibold">{formatDateTime(selectedMatch.scheduled_time)}</span></p>
                )}
                {selectedMatch.winner_id && (
                  <p>Winner: <span className="text-cyan-400 font-extrabold">{profiles.find(p => p.id === selectedMatch.winner_id)?.username}</span></p>
                )}
                {(() => {
                  const opponentId = currentUser.id === selectedMatch.player1_id ? selectedMatch.player2_id : selectedMatch.player1_id;
                  const opponent = profiles.find(profile => profile.id === opponentId);
                  return opponentId ? (
                    <button
                      onClick={() => {
                        setSelectedMatch(null);
                        openChatWithMember(opponentId);
                      }}
                      className="mt-2 inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20"
                    >
                      DM {getProfileDisplayName(opponent)}
                    </button>
                  ) : null;
                })()}

                {canManageActiveTournament && selectedMatch.status !== 'completed' && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-cyan-300 font-bold">Match schedule</p>
                      <span className="text-[11px] text-gray-400">Organizer control</span>
                    </div>
                    <p className="text-[11px] text-gray-400">Adjust the scheduled match time and notify participants instantly.</p>
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
                      <label className="w-full space-y-1 text-[10px] text-gray-400">
                        New match time
                        <input
                          type="datetime-local"
                          value={rescheduleTime}
                          onChange={(e) => setRescheduleTime(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/75 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleRescheduleMatch}
                        disabled={actionLoading}
                        className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-black hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading ? 'Rescheduling...' : 'Reschedule'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ACTION FOR PLAYERS: SUBMIT RESULTS FORM */}
              {selectedMatch.status === 'playing' && 
               (currentUser.id === selectedMatch.player1_id || currentUser.id === selectedMatch.player2_id) && (
                <form onSubmit={handleSubmitScore} className="border-t border-white/5 pt-4 space-y-3.5">
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-cyan-400 flex items-center gap-1">
                    <Upload className="h-3.5 w-3.5" />
                    Submit Match Scorecard
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase font-semibold">Your Opponent Score</label>
                      <input 
                        type="number" 
                        min="0"
                        value={currentUser.id === selectedMatch.player1_id ? p2ReportScore : p1ReportScore}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (currentUser.id === selectedMatch.player1_id) setP2ReportScore(val);
                          else setP1ReportScore(val);
                        }}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase font-semibold">Your Score</label>
                      <input 
                        type="number" 
                        min="0"
                        value={currentUser.id === selectedMatch.player1_id ? p1ReportScore : p2ReportScore}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (currentUser.id === selectedMatch.player1_id) setP1ReportScore(val);
                          else setP2ReportScore(val);
                        }}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-semibold">Proof Upload</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white file:mr-3 file:rounded-full file:border-0 file:bg-cyan-500/15 file:px-3 file:py-1 file:text-[11px] file:font-semibold file:text-cyan-300"
                    />
                    <input 
                      type="url" 
                      placeholder="Or paste a public proof URL"
                      value={proofUrlInput}
                      onChange={(e) => setProofUrlInput(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-750"
                    />
                    <p className="text-[10px] text-gray-500">Upload a screenshot or document directly to the tournament proof gallery.</p>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingScore}
                    className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    {submittingScore ? 'Submitting...' : 'Submit Score & Proof'}
                  </button>
                </form>
              )}

              {/* ACTION FOR ORGANIZERS: FORCE VERIFY / DISPUTE RESOLUTION */}
              {canManageActiveTournament && 
               selectedMatch.status !== 'completed' && selectedMatch.player1_id && selectedMatch.player2_id && (
                <div className="border-t border-white/5 pt-4 space-y-4">
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                    <Shield className="h-4 w-4" />
                    Organizer Verification Panel
                  </h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Verify reported card files. Select the match winner and enter the verified scores to lock results and advance players.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 uppercase font-semibold">Player 1 Score</label>
                      <input 
                        type="number" 
                        min="0"
                        value={p1ReportScore}
                        onChange={(e) => setP1ReportScore(Number(e.target.value))}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 uppercase font-semibold">Player 2 Score</label>
                      <input 
                        type="number" 
                        min="0"
                        value={p2ReportScore}
                        onChange={(e) => setP2ReportScore(Number(e.target.value))}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* Winner selection buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleVerifyResult(selectedMatch.id, selectedMatch.player1_id!, p1ReportScore, p2ReportScore)}
                      disabled={actionLoading}
                      className="py-2 px-3 border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-400 font-bold rounded-lg text-xs transition-colors cursor-pointer text-center truncate"
                    >
                      🏆 P1 Won
                    </button>
                    <button
                      onClick={() => handleVerifyResult(selectedMatch.id, selectedMatch.player2_id!, p1ReportScore, p2ReportScore)}
                      disabled={actionLoading}
                      className="py-2 px-3 border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-400 font-bold rounded-lg text-xs transition-colors cursor-pointer text-center truncate"
                    >
                      🏆 P2 Won
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
