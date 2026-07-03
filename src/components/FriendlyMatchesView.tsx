import { useState, useEffect, useMemo } from 'react';
import { Search, Swords, Plus, CheckCircle2, ArrowRight, Shield, Activity, FileText, UploadCloud, UserPlus, X } from 'lucide-react';
import { Profile, Game, FriendChallenge } from '../types';
import { db } from '../services/db';
import { useToast } from './Toast';

interface FriendlyMatchesViewProps {
  currentUser: Profile;
  profiles: Profile[];
  games: Game[];
  setActiveTab: (tab: string) => void;
  onRefreshApp: () => void;
}

const MIN_SEARCH_LENGTH = 2;

export default function FriendlyMatchesView({ currentUser, profiles, games, setActiveTab, onRefreshApp }: FriendlyMatchesViewProps) {
  const toast = useToast();
  const [friendChallenges, setFriendChallenges] = useState<FriendChallenge[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<Profile | null>(null);
  const [challengeTitle, setChallengeTitle] = useState('Friendly showdown');
  const [challengeGame, setChallengeGame] = useState(games[0]?.id || '');
  const [challengeMessage, setChallengeMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resultForms, setResultForms] = useState<Record<string, { hostScore: string; opponentScore: string; proofUrl: string; expanded?: boolean }>>({});

  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const visibleChallenges = friendChallenges.filter((challenge) => challenge.host_id === currentUser.id || challenge.opponent_id === currentUser.id);

  useEffect(() => {
    if ((!challengeGame || !games.some((game) => game.id === challengeGame)) && games.length > 0) {
      setChallengeGame(games[0].id);
    }
  }, [games, challengeGame]);

  useEffect(() => {
    const loadChallenges = async () => {
      try {
        setLoading(true);
        const allChallenges = await db.getFriendChallenges();
        setFriendChallenges(allChallenges);
      } catch (err) {
        console.error('Failed to load friendly matches:', err);
      } finally {
        setLoading(false);
      }
    };
    loadChallenges();
  }, [currentUser.id]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const handler = window.setTimeout(async () => {
      if (searchQuery.trim().length < MIN_SEARCH_LENGTH) {
        setSearchResults([]);
        return;
      }

      try {
        const profilesFromSearch = await db.searchProfiles(searchQuery);
        setSearchResults(profilesFromSearch.filter((profile) => profile.id !== currentUser.id));
      } catch (err) {
        console.error('Failed to search profiles:', err);
        setSearchResults([]);
      }
    }, 300);

    return () => window.clearTimeout(handler);
  }, [searchQuery, currentUser.id]);

  const searchSuggestions = useMemo(() => {
    if (searchQuery.trim().length >= MIN_SEARCH_LENGTH) {
      return searchResults;
    }
    return profiles
      .filter((profile) => profile.id !== currentUser.id)
      .slice(0, 6);
  }, [searchQuery, searchResults, profiles, currentUser.id]);

  const loadChallenges = async () => {
    try {
      setLoading(true);
      const allChallenges = await db.getFriendChallenges();
      setFriendChallenges(allChallenges);
    } catch (err) {
      console.error('Failed to load friendly matches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOpponent = (profile: Profile) => {
    setSelectedOpponent(profile);
    setSearchQuery('');
    setSearchResults([]);
    setChallengeMessage(null);
  };

  const handleCreateChallenge = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOpponent || !challengeGame) {
      setChallengeMessage('Pick an opponent and game to create a friendly match.');
      return;
    }

    try {
      setSubmitting(true);
      await db.createFriendChallenge(
        currentUser.id,
        selectedOpponent.id,
        selectedOpponent.username,
        challengeGame,
        challengeTitle.trim() || 'Friendly showdown'
      );
      setChallengeMessage(`Challenge sent to ${selectedOpponent.username}.`);
      toast.show(`Challenge sent to ${selectedOpponent.username}.`, 'success');
      setSelectedOpponent(null);
      setChallengeTitle('Friendly showdown');
      await loadChallenges();
      onRefreshApp();
    } catch (err: any) {
      console.error('Failed to create friendly challenge:', err);
      const message = 'Unable to send the friendly challenge. Please try again.';
      setChallengeMessage(message);
      toast.show(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptChallenge = async (challengeId: string) => {
    try {
      await db.acceptFriendChallenge(challengeId, currentUser.id);
      setChallengeMessage('Challenge accepted. Good luck!');
      toast.show('Challenge accepted. Good luck!', 'success');
      await loadChallenges();
      onRefreshApp();
    } catch (err: any) {
      console.error('Failed to accept friendly challenge:', err);
      const message = 'Could not accept the challenge at this time.';
      setChallengeMessage(message);
      toast.show(message, 'error');
    }
  };

  const toggleResultForm = (challengeId: string) => {
    setResultForms((prev) => ({
      ...prev,
      [challengeId]: {
        hostScore: prev[challengeId]?.hostScore ?? '',
        opponentScore: prev[challengeId]?.opponentScore ?? '',
        proofUrl: prev[challengeId]?.proofUrl ?? '',
        expanded: !prev[challengeId]?.expanded
      }
    }));
  };

  const handleResultChange = (challengeId: string, field: 'hostScore' | 'opponentScore' | 'proofUrl', value: string) => {
    setResultForms((prev) => ({
      ...prev,
      [challengeId]: {
        ...prev[challengeId],
        [field]: value
      }
    }));
  };

  const handleSubmitResult = async (challenge: FriendChallenge) => {
    const form = resultForms[challenge.id] || { hostScore: '', opponentScore: '', proofUrl: '' };
    const hostScore = Number(form.hostScore);
    const opponentScore = Number(form.opponentScore);

    if (Number.isNaN(hostScore) || Number.isNaN(opponentScore)) {
      setChallengeMessage('Enter valid numeric scores before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      await db.submitFriendChallengeResult(challenge.id, currentUser.id, hostScore, opponentScore, form.proofUrl.trim());
      setChallengeMessage('Result submitted. The match will be verified shortly.');
      await loadChallenges();
      setResultForms((prev) => ({
        ...prev,
        [challenge.id]: { ...prev[challenge.id], expanded: false }
      }));
    } catch (err) {
      console.error('Failed to submit friendly match result:', err);
      setChallengeMessage('Unable to submit the match result.');
    } finally {
      setSubmitting(false);
    }
  };

  const getOpponentLabel = (challenge: FriendChallenge) => {
    if (challenge.opponent_id) {
      return profileMap.get(challenge.opponent_id)?.username || challenge.opponent_name || 'Opponent';
    }
    return challenge.opponent_name || 'Opponent';
  };

  const canReportResult = (challenge: FriendChallenge) => {
    const isParticipant = challenge.host_id === currentUser.id || challenge.opponent_id === currentUser.id;
    return (
      challenge.status === 'accepted' &&
      isParticipant &&
      challenge.host_score == null &&
      challenge.opponent_score == null
    );
  };

  const pendingIncoming = visibleChallenges.filter(
    (challenge) => challenge.status === 'pending' && challenge.opponent_id === currentUser.id
  );
  const pendingOutgoing = visibleChallenges.filter(
    (challenge) => challenge.status === 'pending' && challenge.host_id === currentUser.id
  );
  const activeMatches = visibleChallenges.filter((challenge) => challenge.status === 'accepted');
  const finishedMatches = visibleChallenges.filter((challenge) => challenge.status === 'completed' || challenge.status === 'flagged');

  return (
    <div className="space-y-8 animate-in fade-in duration-300 text-left">
      <div className="rounded-[32px] border border-white/10 bg-zinc-950/70 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-400">Friendly matches</p>
            <h1 className="text-3xl font-black tracking-tight text-white">Friendly match search & challenge flow</h1>
            <p className="max-w-2xl text-sm text-zinc-400 mt-2">Search eTournament players in the database, pick an opponent, and manage friendly matches on a dedicated page.</p>
          </div>
          <button
            onClick={() => setActiveTab('dashboard')}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <ArrowRight className="h-4 w-4" />
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">Challenge a player</h2>
                <p className="text-xs text-zinc-500">Only players registered in the eTournament database can be challenged.</p>
              </div>
              <div className="rounded-full bg-cyan-500/10 p-2 text-cyan-300">
                <Swords className="h-4 w-4" />
              </div>
            </div>

            <form onSubmit={handleCreateChallenge} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">Find opponent</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    value={selectedOpponent ? selectedOpponent.username : searchQuery}
                    onChange={(event) => {
                      setSelectedOpponent(null);
                      setSearchQuery(event.target.value);
                    }}
                    placeholder="Search by username or email"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-cyan-500/50"
                  />
                </div>
                {searchQuery.trim().length > 0 && searchQuery.trim().length < MIN_SEARCH_LENGTH && (
                  <p className="text-[11px] text-amber-300">Type at least {MIN_SEARCH_LENGTH} characters to search.</p>
                )}
                {searchSuggestions.length > 0 && !selectedOpponent && (
                  <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-3 space-y-2 max-h-60 overflow-y-auto">
                    {searchSuggestions.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => handleSelectOpponent(profile)}
                        className="w-full rounded-2xl border border-white/5 bg-white/5 px-3 py-2 text-left text-sm text-white transition hover:border-cyan-500/30 hover:bg-cyan-500/10"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span>{profile.username}</span>
                          <span className="text-[11px] text-zinc-500">{profile.role}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate">{profile.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedOpponent && (
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">Selected opponent</p>
                      <p className="text-xs text-zinc-300">{selectedOpponent.username} • {selectedOpponent.role}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedOpponent(null)}
                      className="rounded-full bg-white/5 p-2 text-zinc-200 hover:bg-white/10"
                      title="Clear selection"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">Game</label>
                  <select
                    value={challengeGame}
                    onChange={(e) => setChallengeGame(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-500/50"
                  >
                    {games.map((game) => (
                      <option key={game.id} value={game.id}>{game.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">Title</label>
                  <input
                    value={challengeTitle}
                    onChange={(event) => setChallengeTitle(event.target.value)}
                    placeholder="Friendly showdown"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-500/50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-zinc-500">Report match results after the opponent accepts. Verified wins award rank points.</p>
                <button
                  type="submit"
                  disabled={submitting || !selectedOpponent || !challengeGame}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-500/50"
                >
                  <Plus className="h-4 w-4" />
                  Create challenge
                </button>
              </div>
            </form>

            {challengeMessage && (
              <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                {challengeMessage}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">My active friendly matches</h2>
                <p className="text-xs text-zinc-500">Track invitations, acceptances and match results.</p>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                {visibleChallenges.length} total
              </span>
            </div>

            <div className="space-y-3">
              {loading ? (
                <p className="text-xs text-zinc-500">Loading friendly matches...</p>
              ) : visibleChallenges.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-400">
                  No friendly challenge activity yet. Start one above and invite a player.
                </div>
              ) : (
                visibleChallenges.map((challenge) => {
                  const hostProfile = profileMap.get(challenge.host_id);
                  const opponentProfile = challenge.opponent_id ? profileMap.get(challenge.opponent_id) : null;
                  const opponentLabel = getOpponentLabel(challenge);
                  const isOpponent = challenge.opponent_id === currentUser.id;

                  return (
                    <div key={challenge.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">{challenge.title}</p>
                          <p className="text-[11px] text-zinc-500">
                            {hostProfile?.username || 'Host'} vs {opponentProfile?.username || opponentLabel}
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-400">{games.find((game) => game.id === challenge.game_id)?.name || 'Match'} • {challenge.status}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                            {challenge.integrity_status}
                          </span>
                          {challenge.status === 'pending' && isOpponent && (
                            <button
                              onClick={() => handleAcceptChallenge(challenge.id)}
                              className="rounded-2xl bg-cyan-500 px-3 py-2 text-xs font-semibold text-black"
                            >
                              Accept
                            </button>
                          )}
                        </div>
                      </div>

                      {challenge.status === 'accepted' && challenge.host_score == null && challenge.opponent_score == null && canReportResult(challenge) && (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="flex items-center justify-between gap-3 mb-3 text-sm text-zinc-300">
                            <span>Report match result</span>
                            <button
                              onClick={() => toggleResultForm(challenge.id)}
                              className="text-cyan-300 hover:text-cyan-200"
                            >
                              {resultForms[challenge.id]?.expanded ? 'Hide' : 'Show'}
                            </button>
                          </div>
                          {resultForms[challenge.id]?.expanded ? (
                            <div className="space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <input
                                  type="number"
                                  value={resultForms[challenge.id]?.hostScore ?? ''}
                                  onChange={(event) => handleResultChange(challenge.id, 'hostScore', event.target.value)}
                                  placeholder={`${hostProfile?.username || 'Host'} score`}
                                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none"
                                />
                                <input
                                  type="number"
                                  value={resultForms[challenge.id]?.opponentScore ?? ''}
                                  onChange={(event) => handleResultChange(challenge.id, 'opponentScore', event.target.value)}
                                  placeholder={`${opponentLabel} score`}
                                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Proof URL</label>
                                <input
                                  type="url"
                                  value={resultForms[challenge.id]?.proofUrl ?? ''}
                                  onChange={(event) => handleResultChange(challenge.id, 'proofUrl', event.target.value)}
                                  placeholder="Screenshot or replay link"
                                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none"
                                />
                              </div>
                              <button
                                onClick={() => handleSubmitResult(challenge)}
                                disabled={submitting}
                                className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-500/50"
                              >
                                <UploadCloud className="h-4 w-4" />
                                Submit result
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-500">Record the match score and share proof to complete this friendly challenge.</p>
                          )}
                        </div>
                      )}

                      {challenge.status !== 'pending' && (challenge.host_score != null || challenge.opponent_score != null) && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm text-zinc-300">
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Host score</p>
                            <p className="mt-2 text-lg font-bold text-white">{challenge.host_score ?? '-'}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Opponent score</p>
                            <p className="mt-2 text-lg font-bold text-white">{challenge.opponent_score ?? '-'}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Proof</p>
                            <p className="mt-2 text-sm text-cyan-300 truncate">{challenge.proof_url || 'None submitted'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Quick match controls</h2>
                <p className="text-xs text-zinc-500">Manage incoming invites and see your current friendly season status.</p>
              </div>
              <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">{visibleChallenges.length} matches</span>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Shield className="h-4 w-4 text-cyan-300" />
                  <span>All opponents are verified eTournament profiles.</span>
                </div>
                <p className="mt-3 text-xs text-zinc-500">This flow prevents free-text invites and keeps friendly games tied to database accounts.</p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Pending invitations</p>
                  <p className="mt-2 text-sm text-white">{pendingOutgoing.length} sent</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Incoming invites</p>
                  <p className="mt-2 text-sm text-white">{pendingIncoming.length} waiting</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Accepted matches</p>
                  <p className="mt-2 text-sm text-white">{activeMatches.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <h2 className="text-lg font-bold text-white">Need more opponents?</h2>
            <p className="mt-2 text-sm text-zinc-400">Use the player search above or visit the Friends page to build your eTournament roster. Every match starts from a verified database profile.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
