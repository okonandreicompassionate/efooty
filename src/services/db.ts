import { supabase, isSupabaseConfigured } from '../supabase';
import {
  Profile,
  Game,
  Tournament,
  TournamentPlayer,
  Match,
  MatchResult,
  Notification,
  Achievement,
  Leaderboard,
  PlayerStatistics,
  ActivityLog,
  Settings,
  UserRole,
  TournamentStatus,
  PlayerRegistrationStatus,
  UserAchievement,
  ChatMessage,
  FriendChallenge,
  Friendship,
  TournamentRosterCount
} from '../types';

const assertSupabase = () => {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Live mode requires a connected Supabase database.');
  }
};

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const getSupabaseAuthUser = async () => {
  assertSupabase();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[db] supabase.auth.getUser() failed:', error);
    throw error;
  }

  if (!user?.id) {
    throw new Error('No authenticated Supabase user found.');
  }

  if (!isUuid(user.id)) {
    throw new Error(`Authenticated Supabase user id is not a valid UUID: ${user.id}`);
  }

  return user;
};

const getSupabaseUserWithProfile = async () => {
  assertSupabase();
  const authUser = await getSupabaseAuthUser();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authUser.id)
    .maybeSingle();

  if (profileError) throw profileError;

  return {
    authUser,
    profile: profile as { role?: string } | null
  };
};

const DEFAULT_GAMES: Omit<Game, 'created_at' | 'id'>[] = [
  {
    name: 'eFootball',
    slug: 'efootball',
    icon: 'Gamepad2',
    cover_image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=60'
  },
  {
    name: 'EA FC 26',
    slug: 'ea-fc-26',
    icon: 'Trophy',
    cover_image: 'https://images.unsplash.com/photo-1540747737956-37872404a82f?w=800&auto=format&fit=crop&q=60'
  }
];

const DEFAULT_ACHIEVEMENTS: Omit<Achievement, 'id'>[] = [
  { name: 'First Victory', description: 'Win your first tournament match', badge_icon: 'Award', xp_reward: 100 },
  { name: 'Champion Ascent', description: 'Win an eTournament grand championship tournament', badge_icon: 'Trophy', xp_reward: 500 }
];

const ensureProfileAndSettings = async (userId: string, authUser: any) => {
  assertSupabase();

  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('[db] Failed to read profile while seeding:', profileError);
    return;
  }

  if (!existingProfile) {
    const username = authUser?.user_metadata?.username || authUser?.email?.split('@')[0] || 'player';
    const role = authUser?.user_metadata?.role || 'player';

    const { error: insertProfileError } = await supabase.from('profiles').insert({
      id: userId,
      username,
      email: authUser?.email || `${username}@etournament.local`,
      avatar_url: authUser?.user_metadata?.avatar_url || null,
      role,
      bio: 'Joined through eTournament live mode.'
    });

    if (insertProfileError) {
      console.error('[db] Failed to create profile for authenticated user:', insertProfileError);
    }
  }

  const { data: existingSettings, error: settingsError } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (settingsError) {
    console.error('[db] Failed to read settings while seeding:', settingsError);
    return;
  }

  if (!existingSettings) {
    const { error: insertSettingsError } = await supabase.from('settings').insert({
      user_id: userId,
      push_notifications: true,
      email_notifications: true,
      public_profile: true,
      dark_mode: true,
      show_email: false,
      allow_dms: true,
      anonymous_mode: false
    });

    if (insertSettingsError) {
      console.error('[db] Failed to create settings for authenticated user:', insertSettingsError);
    }
  }
};

const ensureGamesSeeded = async () => {
  assertSupabase();

  const { data: existingGames, error: gamesReadError } = await supabase
    .from('games')
    .select('slug');

  if (gamesReadError) {
    console.error('[db] Failed to read games table while seeding:', gamesReadError);
    return;
  }

  const existingSlugs = new Set((existingGames || []).map((g: any) => g.slug));
  const gamesToSeed = DEFAULT_GAMES.filter(g => !existingSlugs.has(g.slug));

  if (gamesToSeed.length === 0) return;

  const { error: gamesInsertError } = await supabase.from('games').insert(gamesToSeed);
  if (gamesInsertError) {
    console.error('[db] Failed to seed default games:', gamesInsertError);
  }
};

const ensureAchievementsSeeded = async () => {
  assertSupabase();

  const { data: existingAchievements, error: achievementsError } = await supabase.from('achievements').select('name');
  if (achievementsError) {
    console.error('[db] Failed to read achievements table while seeding:', achievementsError);
    return;
  }

  const existingNames = new Set((existingAchievements || []).map((a: any) => a.name));
  const achievementsToSeed = DEFAULT_ACHIEVEMENTS.filter(a => !existingNames.has(a.name));

  if (achievementsToSeed.length === 0) return;

  const { error: insertError } = await supabase.from('achievements').insert(achievementsToSeed);
  if (insertError) {
    console.error('[db] Failed to seed default achievements:', insertError);
  }
};

export const ensureDbSeeded = async () => {
  assertSupabase();

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user?.id) return;

  await ensureProfileAndSettings(user.id, user);
  await ensureGamesSeeded();
  await ensureAchievementsSeeded();
};

const awardRankPoints = async (
  userId: string,
  gameId: string,
  delta: number,
  reason: string,
  username?: string,
  avatarUrl?: string
) => {
  assertSupabase();

  const { data: existing, error } = await supabase
    .from('leaderboards')
    .select('*')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .maybeSingle();

  if (error) {
    console.error('[db] awardRankPoints failed:', error);
    return;
  }

  if (existing) {
    await supabase
      .from('leaderboards')
      .update({ rank_points: (existing.rank_points || 0) + delta, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    return;
  }

  await supabase.from('leaderboards').insert({
    user_id: userId,
    game_id: gameId,
    rank_points: Math.max(0, delta),
    username,
    avatar_url: avatarUrl
  });
};

const generateUuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const buildSingleEliminationMatches = (playerIds: string[], tournamentId: string, start: string, slotMinutes: number): any[] => {
  const now = new Date().toISOString();
  const rounds = Math.ceil(Math.log2(playerIds.length));
  const roundIds: string[][] = [];
  for (let round = 1; round <= rounds; round++) {
    roundIds[round] = Array.from({ length: 2 ** (rounds - round) }, () => generateUuid());
  }

  const matches: any[] = [];
  let cursor = new Date(start).getTime();
  let matchNo = 1;

  for (let round = 1; round <= rounds; round++) {
    const totalMatches = roundIds[round].length;
    for (let index = 0; index < totalMatches; index++) {
      const player1_id = round === 1 ? playerIds[index * 2] || null : null;
      const player2_id = round === 1 ? playerIds[index * 2 + 1] || null : null;
      const next_match_id = round < rounds ? roundIds[round + 1][Math.floor(index / 2)] : null;
      const status = round === 1 && player1_id && player2_id ? 'playing' : 'waiting';

      matches.push({
        id: roundIds[round][index],
        tournament_id: tournamentId,
        player1_id,
        player2_id,
        player1_score: 0,
        player2_score: 0,
        winner_id: null,
        status,
        round_no: round,
        match_no: matchNo++,
        next_match_id,
        scheduled_time: new Date(cursor).toISOString(),
        created_at: now,
        updated_at: now
      });
      cursor += slotMinutes * 60 * 1000;
    }
  }

  return matches;
};

const buildRoundRobinMatches = (playerIds: string[], tournamentId: string, start: string, slotMinutes: number, groupIndex = 0): any[] => {
  const players = [...playerIds];
  if (players.length % 2 === 1) {
    players.push(null as any);
  }

  const rounds = players.length - 1;
  const half = players.length / 2;
  const matches: any[] = [];
  let cursor = new Date(start).getTime();
  let matchNo = 1;
  const now = new Date().toISOString();
  const schedulePlayers = [...players];

  for (let round = 1; round <= rounds; round++) {
    for (let index = 0; index < half; index++) {
      const player1_id = schedulePlayers[index];
      const player2_id = schedulePlayers[players.length - 1 - index];
      if (!player1_id || !player2_id) {
        continue;
      }

      matches.push({
        id: generateUuid(),
        tournament_id: tournamentId,
        player1_id,
        player2_id,
        player1_score: 0,
        player2_score: 0,
        winner_id: null,
        status: 'waiting',
        round_no: groupIndex > 0 ? groupIndex : round,
        match_no: matchNo++,
        next_match_id: null,
        scheduled_time: new Date(cursor).toISOString(),
        created_at: now,
        updated_at: now
      });
      cursor += slotMinutes * 60 * 1000;
    }

    const first = schedulePlayers.splice(1, 1)[0];
    schedulePlayers.push(first);
  }

  return matches;
};

const buildGroupStageMatches = (playerIds: string[], tournamentId: string, start: string, slotMinutes: number): any[] => {
  const groupCount = Math.min(4, Math.max(1, Math.floor(playerIds.length / 4)));
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  playerIds.forEach((id, index) => {
    groups[index % groupCount].push(id);
  });

  const matches: any[] = [];
  let cursor = new Date(start).getTime();
  const now = new Date().toISOString();
  let groupRound = 1;

  groups.forEach((groupPlayers) => {
    if (groupPlayers.length < 2) return;
    const players = [...groupPlayers];
    if (players.length % 2 === 1) players.push(null as any);
    const rounds = players.length - 1;
    const half = players.length / 2;
    const schedulePlayers = [...players];
    let matchNo = 1;

    for (let round = 1; round <= rounds; round++) {
      for (let index = 0; index < half; index++) {
        const player1_id = schedulePlayers[index];
        const player2_id = schedulePlayers[players.length - 1 - index];
        if (!player1_id || !player2_id) continue;

        matches.push({
          id: generateUuid(),
          tournament_id: tournamentId,
          player1_id,
          player2_id,
          player1_score: 0,
          player2_score: 0,
          winner_id: null,
          status: 'waiting',
          round_no: groupRound,
          match_no: matchNo++,
          next_match_id: null,
          scheduled_time: new Date(cursor).toISOString(),
          created_at: now,
          updated_at: now
        });
        cursor += slotMinutes * 60 * 1000;
      }

      const first = schedulePlayers.splice(1, 1)[0];
      schedulePlayers.push(first);
    }

    groupRound += 1;
  });

  return matches;
};

const buildDoubleEliminationMatches = (playerIds: string[], tournamentId: string, start: string, slotMinutes: number): any[] => {
  // For now, generate a single-elimination winner bracket as the base structure.
  // This preserves match generation and allows the double elimination tournament
  // format to show a bracket while more advanced loser-bracket logic is added.
  return buildSingleEliminationMatches(playerIds, tournamentId, start, slotMinutes);
};

const normalizeUsername = (username: string) => username.trim().replace(/\s+/g, '_').toLowerCase();

const maybeGenerateBracketWhenFull = async (tournamentId: string): Promise<boolean> => {
  const tournament = await db.getTournament(tournamentId);
  if (!tournament || tournament.status !== 'registration') return false;

  const { data: existingMatches, error: matchesError } = await supabase
    .from('matches')
    .select('id')
    .eq('tournament_id', tournamentId)
    .limit(1);

  if (matchesError) throw matchesError;
  if (existingMatches && existingMatches.length > 0) return false;

  const { count, error: countError } = await supabase
    .from('tournament_players')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .eq('status', 'approved');

  if (countError) throw countError;
  if ((count || 0) >= tournament.max_players) {
    await db.generateBracket(tournamentId);
    return true;
  }

  return false;
};

const getSettingsFromJoinedProfile = (profile: any) => {
  const settings = Array.isArray(profile.settings) ? profile.settings[0] : profile.settings;
  return {
    public_profile: settings?.public_profile,
    show_email: settings?.show_email,
    allow_dms: settings?.allow_dms,
    anonymous_mode: settings?.anonymous_mode
  };
};

const getDmParticipantIds = (channelId: string): string[] => {
  if (!channelId.startsWith('dm:')) return [];
  return channelId.slice(3).split(':').filter(isUuid);
};

const usersAreFriends = async (userA: string, userB: string): Promise<boolean> => {
  const requesterId = userA < userB ? userA : userB;
  const addresseeId = userA < userB ? userB : userA;
  const { data, error } = await supabase
    .from('friendships')
    .select('id')
    .eq('requester_id', requesterId)
    .eq('addressee_id', addresseeId)
    .eq('status', 'accepted')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
};

const getReservedTournamentSlotCount = async (tournamentId: string, excludeRegistrationId?: string): Promise<number> => {
  assertSupabase();

  let query = supabase
    .from('tournament_players')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .in('status', ['approved', 'pending']);

  if (excludeRegistrationId) {
    query = query.neq('id', excludeRegistrationId);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
};

const getApprovedTournamentSlotCount = async (tournamentId: string, excludeRegistrationId?: string): Promise<number> => {
  assertSupabase();

  let query = supabase
    .from('tournament_players')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .eq('status', 'approved');

  if (excludeRegistrationId) {
    query = query.neq('id', excludeRegistrationId);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
};

export const db = {
  earnAchievement: async (userId: string, achievementName: string): Promise<void> => {
    assertSupabase();

    const { data: achievement, error: achError } = await supabase
      .from('achievements')
      .select('*')
      .eq('name', achievementName)
      .maybeSingle();

    if (achError || !achievement) {
      if (achError) console.error('[db.earnAchievement] Failed to read achievement:', achError);
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .eq('achievement_id', achievement.id)
      .maybeSingle();

    if (existingError) {
      console.error('[db.earnAchievement] Failed to read user achievements:', existingError);
      return;
    }

    if (!existing) {
      await supabase.from('user_achievements').insert({ user_id: userId, achievement_id: achievement.id });
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Achievement Unlocked!',
        content: `You have earned the "${achievement.name}" badge and +${achievement.xp_reward} XP!`,
        is_read: false
      });
    }
  },

  getCurrentUser: async (): Promise<Profile> => {
    assertSupabase();
    await ensureDbSeeded();

    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error) throw error;
    if (!user?.id) throw new Error('No authenticated Supabase user found.');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) throw new Error('Authenticated user profile not found.');

    return profile as Profile;
  },

  updateCurrentUserRole: async (role: UserRole): Promise<Profile> => {
    assertSupabase();
    const user = await getSupabaseAuthUser();

    const { data, error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .maybeSingle();

    if (error || !data) {
      throw error || new Error('Failed to update user role.');
    }

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action_type: 'ROLE_CHANGE',
      description: `Switched role to ${role}`
    });

    return data as Profile;
  },

  updateUserProfile: async (id: string, updates: Partial<Profile>): Promise<Profile> => {
    assertSupabase();

    if (updates.username) {
      const normalizedUsername = normalizeUsername(updates.username);
      if (normalizedUsername.length < 3) {
        throw new Error('Username must be at least 3 characters.');
      }

      const available = await db.isUsernameAvailable(normalizedUsername, id);
      if (!available) {
        throw new Error('That username is already taken.');
      }

      updates.username = normalizedUsername;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error || !data) throw error || new Error('Failed to update user profile.');

    await supabase.from('activity_logs').insert({
      user_id: id,
      action_type: 'PROFILE_UPDATE',
      description: 'Updated user profile information'
    });

    return data as Profile;
  },

  getProfiles: async (): Promise<Profile[]> => {
    assertSupabase();
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return (data || []).map((profile: any) => ({
      ...profile,
      ...getSettingsFromJoinedProfile(profile)
    })) as Profile[];
  },

  searchProfiles: async (query: string): Promise<Profile[]> => {
    assertSupabase();
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const { data, error } = await supabase.from('profiles').select('*').limit(12);
    if (error) throw error;

    return (data || [])
      .filter((profile: any) => {
        const searchableText = `${profile?.username ?? ''} ${profile?.email ?? ''} ${profile?.role ?? ''}`.toLowerCase();
        return searchableText.includes(q);
      })
      .slice(0, 12)
      .map((profile: any) => ({
        ...profile,
        ...getSettingsFromJoinedProfile(profile)
      })) as Profile[];
  },

  isUsernameAvailable: async (username: string, excludeUserId?: string): Promise<boolean> => {
    assertSupabase();
    const normalizedUsername = normalizeUsername(username);
    let query = supabase.from('profiles').select('id').eq('username', normalizedUsername).limit(1);
    if (excludeUserId) query = query.neq('id', excludeUserId);
    const { data, error } = await query;
    if (error) throw error;
    return !data || data.length === 0;
  },

  getGames: async (): Promise<Game[]> => {
    assertSupabase();
    const { data, error } = await supabase.from('games').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data as Game[];
  },

  getTournaments: async (): Promise<Tournament[]> => {
    assertSupabase();
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Tournament[];
  },

  getTournament: async (id: string): Promise<Tournament | undefined> => {
    assertSupabase();
    if (!isUuid(id)) throw new Error('Tournament id must be a valid UUID.');

    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as Tournament | undefined;
  },

  createTournament: async (tournament: Omit<Tournament, 'id' | 'created_at' | 'updated_at' | 'organizer_id'>): Promise<Tournament> => {
    assertSupabase();

    if (!tournament.title?.trim()) throw new Error('Tournament title is required.');
    if (!tournament.start_time?.trim()) throw new Error('Tournament start time is required.');
    if (!tournament.game_id?.trim()) throw new Error('Tournament game_id is required.');
    if (!isUuid(tournament.game_id)) throw new Error('Tournament game_id must be a valid UUID.');

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.warn('[db.createTournament] supabase.auth.getSession failed:', sessionError);
    }

    const sessionUserId = session?.user?.id;
    const accessTokenExists = !!session?.access_token;
    const user = session?.user ?? (await getSupabaseAuthUser());

    if (!accessTokenExists || !sessionUserId) {
      console.error('[db.createTournament] No active Supabase auth session available. Ensure the user is signed in and the access token is present.');
      throw new Error('Tournament creation requires an active Supabase auth session. Please sign in again.');
    }

    if (!user?.id) {
      throw new Error('No authenticated Supabase user found when creating a tournament. Please sign in again.');
    }

    const organizerId = user.id;
    if (sessionUserId !== organizerId) {
      console.error('[db.createTournament] Supabase session user ID does not match authenticated user ID', {
        sessionUserId,
        organizerId
      });
      throw new Error('Authenticated Supabase session user does not match the current organizer. Please sign in again.');
    }

    console.info('[db.createTournament] creating tournament', {
      organizerId,
      sessionUserId,
      hasAccessToken: accessTokenExists,
      game_id: tournament.game_id
    });

    const { data: gameRecord, error: gameError } = await supabase
      .from('games')
      .select('id')
      .eq('id', tournament.game_id)
      .maybeSingle();

    if (gameError || !gameRecord) {
      throw new Error(`Invalid game_id for tournament creation: ${tournament.game_id}`);
    }

    const tournamentToInsert = {
      ...tournament,
      organizer_id: organizerId,
      max_players: Number(tournament.max_players) || 16,
      entry_fee: tournament.entry_fee ?? 0,
      payment_provider: tournament.payment_provider || 'none',
      auto_lock_registration: tournament.auto_lock_registration ?? true,
      points_only: tournament.points_only ?? false,
      slot_minutes: tournament.slot_minutes || 90,
      status: tournament.status || 'registration',
      format: tournament.format || 'single_elimination'
    };

    const { data, error } = await supabase
      .from('tournaments')
      .insert([tournamentToInsert])
      .select()
      .maybeSingle();

    if (error || !data) {
      console.error('[db.createTournament] Failed to create tournament in Supabase:', error);
      throw error || new Error('Failed to create tournament in Supabase.');
    }

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action_type: 'TOURNAMENT_CREATE',
      description: `Created tournament "${tournament.title}"`
    });

    return data as Tournament;
  },

  updateTournamentStatus: async (id: string, status: TournamentStatus, winnerId?: string): Promise<Tournament> => {
    assertSupabase();

    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .update({ status, winner_id: winnerId || null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (tournamentError || !tournament) throw tournamentError || new Error('Failed to update tournament status');

    await supabase.from('activity_logs').insert({
      user_id: tournament.organizer_id,
      action_type: 'TOURNAMENT_UPDATE',
      description: `Tournament "${tournament.title}" status changed to ${status}`
    });

    if (status === 'completed' && winnerId) {
      await db.earnAchievement(winnerId, 'Champion Ascent');

      const { data: players } = await supabase
        .from('tournament_players')
        .select('player_id')
        .eq('tournament_id', id)
        .eq('status', 'approved');

      if (players && players.length > 0) {
        const notificationsToInsert = players.map((p: any) => ({
          user_id: p.player_id,
          title: 'Tournament Crowned!',
          content: `"${tournament.title}" has concluded. Congratulations to the Champion!`,
          link: `/tournaments/${id}`,
          is_read: false
        }));
        await supabase.from('notifications').insert(notificationsToInsert);
      }

      const { data: existingStats } = await supabase
        .from('player_statistics')
        .select('*')
        .eq('user_id', winnerId)
        .eq('game_id', tournament.game_id)
        .maybeSingle();

      if (existingStats) {
        await supabase
          .from('player_statistics')
          .update({
            tournaments_played: (existingStats.tournaments_played || 0) + 1,
            tournaments_won: (existingStats.tournaments_won || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingStats.id);
      } else {
        await supabase.from('player_statistics').insert({
          user_id: winnerId,
          game_id: tournament.game_id,
          matches_played: 0,
          matches_won: 0,
          matches_lost: 0,
          tournaments_played: 1,
          tournaments_won: 1,
          win_rate: 0.0
        });
      }

      await awardRankPoints(winnerId, tournament.game_id, 300, 'Tournament championship', tournament.title, tournament.banner_url);
    }

    return tournament as Tournament;
  },

  getTournamentPlayers: async (tournamentId: string): Promise<TournamentPlayer[]> => {
    assertSupabase();
    const { data, error } = await supabase
      .from('tournament_players')
      .select('*')
      .eq('tournament_id', tournamentId);
    if (error) throw error;
    return data as TournamentPlayer[];
  },

  getRosterCounts: async (): Promise<TournamentRosterCount[]> => {
    assertSupabase();
    const { data, error } = await supabase
      .from('tournament_players')
      .select('tournament_id, status');
    if (error) throw error;

    const counts = new Map<string, TournamentRosterCount>();
    for (const row of (data || []) as any[]) {
      const existing = counts.get(row.tournament_id) || {
        tournament_id: row.tournament_id,
        total: 0,
        approved: 0,
        pending: 0
      };
      existing.total += 1;
      if (row.status === 'approved') existing.approved += 1;
      if (row.status === 'pending') existing.pending += 1;
      counts.set(row.tournament_id, existing);
    }
    return Array.from(counts.values());
  },

  getMyTournamentRegistrations: async (userId: string): Promise<TournamentPlayer[]> => {
    assertSupabase();
    const { data, error } = await supabase
      .from('tournament_players')
      .select('*')
      .eq('player_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as TournamentPlayer[];
  },

  registerPlayer: async (tournamentId: string, playerId: string, registrationData: Partial<TournamentPlayer> = {}): Promise<TournamentPlayer> => {
    assertSupabase();
    const tournament = await db.getTournament(tournamentId);
    if (!tournament) throw new Error('Tournament not found.');
    if (tournament.status !== 'registration') throw new Error('Registration is closed for this tournament.');

    const requiresPayment = Boolean(tournament.entry_fee && tournament.entry_fee > 0);
    const defaultStatus: PlayerRegistrationStatus = requiresPayment ? 'pending' : 'approved';
    const defaultPaymentStatus = requiresPayment ? 'pending' : 'free';

    if (tournament.organizer_id === playerId) {
      throw new Error('The tournament host cannot join their own tournament as a competitor.');
    }

    const { data: existing } = await supabase
      .from('tournament_players')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('player_id', playerId)
      .maybeSingle();

    if (existing) return existing as TournamentPlayer;

    const reservedSlotCount = await getReservedTournamentSlotCount(tournamentId);
    if (reservedSlotCount >= tournament.max_players) {
      throw new Error('This tournament is full.');
    }

    const { data: insertedRegistration, error: insertError } = await supabase
      .from('tournament_players')
      .insert([{
        tournament_id: tournamentId,
        player_id: playerId,
        status: defaultStatus,
        display_name: registrationData.display_name || null,
        email: registrationData.email || null,
        region: registrationData.region || null,
        team_name: registrationData.team_name || null,
        notes: registrationData.notes || null,
        paid: !requiresPayment,
        payment_status: defaultPaymentStatus,
        payment_reference: registrationData.payment_reference || null
      }])
      .select()
      .maybeSingle();

    if (insertError || !insertedRegistration) {
      throw insertError || new Error('Failed to register for tournament.');
    }

    return insertedRegistration as TournamentPlayer;
  },

  approvePlayer: async (registrationId: string, status: PlayerRegistrationStatus): Promise<TournamentPlayer> => {
    assertSupabase();

    if (status !== 'approved' && status !== 'rejected') {
      throw new Error('Invalid registration status update.');
    }

    const { data: existingReg, error: existingRegError } = await supabase
      .from('tournament_players')
      .select('*')
      .eq('id', registrationId)
      .maybeSingle();

    if (existingRegError || !existingReg) throw existingRegError || new Error('Registration not found.');

    const tournament = await db.getTournament(existingReg.tournament_id);
    if (!tournament) throw new Error('Tournament not found.');

    if (status === 'approved') {
      const approvedCount = await getApprovedTournamentSlotCount(existingReg.tournament_id, registrationId);
      if (approvedCount >= tournament.max_players) {
        throw new Error('This approval would exceed the tournament player limit.');
      }
    }

    const { data: updatedReg, error: updateError } = await supabase
      .from('tournament_players')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', registrationId)
      .select()
      .maybeSingle();

    if (updateError || !updatedReg) throw updateError || new Error('Failed to update registration');

    await supabase.from('notifications').insert({
      user_id: updatedReg.player_id,
      title: status === 'approved' ? 'Registration Approved!' : 'Registration Update',
      content: `Your slot in "${tournament.title}" has been ${status}.`,
      link: `/tournaments/${updatedReg.tournament_id}`,
      is_read: false
    });

    if (status === 'approved') await maybeGenerateBracketWhenFull(updatedReg.tournament_id);

    return updatedReg as TournamentPlayer;
  },

  submitPaymentReference: async (registrationId: string, paymentReference: string): Promise<TournamentPlayer> => {
    assertSupabase();
    if (!paymentReference.trim()) throw new Error('Payment reference is required.');

    const { data: reg, error } = await supabase
      .from('tournament_players')
      .update({
        payment_reference: paymentReference.trim(),
        payment_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', registrationId)
      .select()
      .maybeSingle();

    if (error || !reg) throw error || new Error('Failed to submit payment reference.');

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('title, organizer_id')
      .eq('id', reg.tournament_id)
      .maybeSingle();

    if (tournament?.organizer_id) {
      await supabase.from('notifications').insert({
        user_id: tournament.organizer_id,
        title: 'Payment needs review',
        content: `A payment reference was submitted for "${tournament.title}". Verify it before approving the slot.`,
        link: `/tournaments/${reg.tournament_id}`,
        is_read: false
      });
    }

    return reg as TournamentPlayer;
  },

  markRegistrationPaid: async (registrationId: string, paymentReference: string): Promise<TournamentPlayer> => {
    assertSupabase();

    const currentUser = await db.getCurrentUser();
    const { data: existingReg, error: existingRegError } = await supabase
      .from('tournament_players')
      .select('tournament_id, payment_reference')
      .eq('id', registrationId)
      .maybeSingle();

    if (existingRegError || !existingReg) throw existingRegError || new Error('Registration not found.');

    const tournament = await db.getTournament(existingReg.tournament_id);
    if (!tournament) throw new Error('Tournament not found.');
    if (currentUser.id !== tournament.organizer_id && currentUser.role !== 'admin') {
      throw new Error('Only the tournament host can approve payment.');
    }

    const finalReference = paymentReference.trim() || existingReg.payment_reference;
    if (!finalReference) throw new Error('A verifiable payment reference is required.');

    const approvedCount = await getApprovedTournamentSlotCount(existingReg.tournament_id, registrationId);
    if (approvedCount >= tournament.max_players) {
      throw new Error('This tournament is full.');
    }

    const { data: reg, error } = await supabase
      .from('tournament_players')
      .update({
        status: 'approved',
        paid: true,
        payment_status: 'paid',
        payment_reference: finalReference,
        updated_at: new Date().toISOString()
      })
      .eq('id', registrationId)
      .select()
      .maybeSingle();

    if (error || !reg) throw error || new Error('Failed to confirm payment');

    await maybeGenerateBracketWhenFull(reg.tournament_id);

    await supabase.from('notifications').insert({
      user_id: reg.player_id,
      title: 'Payment approved',
      content: `Your payment for "${tournament.title}" was verified and your tournament slot is approved.`,
      link: `/tournaments/${reg.tournament_id}`,
      is_read: false
    });

    return reg as TournamentPlayer;
  },

  removeTournamentPlayer: async (registrationId: string, reason: string, disqualify = false): Promise<void> => {
    assertSupabase();
    const currentUser = await db.getCurrentUser();

    const { data: reg, error: regError } = await supabase
      .from('tournament_players')
      .select('*')
      .eq('id', registrationId)
      .maybeSingle();

    if (regError || !reg) throw regError || new Error('Registration not found.');

    const tournament = await db.getTournament(reg.tournament_id);
    if (!tournament) throw new Error('Tournament not found.');
    if (currentUser.id !== tournament.organizer_id && currentUser.role !== 'admin') {
      throw new Error('Only the tournament host can manage competitors.');
    }

    const cleanReason = reason.trim() || (disqualify ? 'Disqualified by tournament host.' : 'Removed by tournament host.');

    if (tournament.status === 'active' || disqualify) {
      const { error: updateError } = await supabase
        .from('tournament_players')
        .update({
          status: 'rejected',
          notes: [reg.notes, cleanReason].filter(Boolean).join('\n'),
          updated_at: new Date().toISOString()
        })
        .eq('id', registrationId);
      if (updateError) throw updateError;

      const { data: openMatch } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', reg.tournament_id)
        .in('status', ['waiting', 'playing', 'disputed'])
        .or(`player1_id.eq.${reg.player_id},player2_id.eq.${reg.player_id}`)
        .order('round_no', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (openMatch) {
        const opponentId = openMatch.player1_id === reg.player_id ? openMatch.player2_id : openMatch.player1_id;
        if (opponentId) {
          await db.verifyMatchResult(
            openMatch.id,
            opponentId,
            openMatch.player1_id === opponentId ? 3 : 0,
            openMatch.player2_id === opponentId ? 3 : 0
          );
        } else {
          const { error: matchUpdateError } = await supabase
            .from('matches')
            .update({ status: 'waiting', updated_at: new Date().toISOString() })
            .eq('id', openMatch.id);
          if (matchUpdateError) throw matchUpdateError;
        }
      }
    } else {
      const { error: deleteError } = await supabase.from('tournament_players').delete().eq('id', registrationId);
      if (deleteError) throw deleteError;
    }

    await supabase.from('notifications').insert({
      user_id: reg.player_id,
      title: disqualify ? 'Tournament disqualification' : 'Tournament slot removed',
      content: `${disqualify ? 'You were disqualified from' : 'You were removed from'} "${tournament.title}". Reason: ${cleanReason}`,
      link: `/tournaments/${reg.tournament_id}`,
      is_read: false
    });

    await supabase.from('activity_logs').insert({
      user_id: currentUser.id,
      action_type: disqualify ? 'PLAYER_DISQUALIFY' : 'PLAYER_REMOVE',
      description: `${disqualify ? 'Disqualified' : 'Removed'} a player from "${tournament.title}": ${cleanReason}`
    });
  },

  sendTournamentNotice: async (tournamentId: string, recipientId: string, title: string, content: string): Promise<void> => {
    assertSupabase();
    const { data: tournament } = await supabase.from('tournaments').select('title').eq('id', tournamentId).maybeSingle();

    await supabase.from('notifications').insert({
      user_id: recipientId,
      title: title || 'Tournament Update',
      content: content || `A message was sent about "${tournament?.title || 'your tournament'}".`,
      link: `/tournaments/${tournamentId}`,
      is_read: false
    });
  },

  getMatches: async (tournamentId: string): Promise<Match[]> => {
    assertSupabase();
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_no', { ascending: true })
      .order('match_no', { ascending: true });
    if (error) throw error;
    return data as Match[];
  },

  generateBracket: async (tournamentId: string): Promise<Match[]> => {
    assertSupabase();

    const { data: existingMatches, error: existingMatchesError } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_no', { ascending: true })
      .order('match_no', { ascending: true });

    if (existingMatchesError) throw existingMatchesError;
    if (existingMatches && existingMatches.length > 0) return existingMatches as Match[];

    const tournament = await db.getTournament(tournamentId);
    if (!tournament) throw new Error('Tournament not found.');

    const { authUser, profile } = await getSupabaseUserWithProfile();
    const canManageBracket = profile?.role === 'admin' || tournament.organizer_id === authUser.id;

    if (!canManageBracket) {
      throw new Error('Only the tournament organizer or an admin can generate a bracket.');
    }

    const { data: approvedPlayers, error: playersError } = await supabase
      .from('tournament_players')
      .select('player_id')
      .eq('tournament_id', tournamentId)
      .eq('status', 'approved');

    if (playersError) throw playersError;

    const playerIds = (approvedPlayers || [])
      .map((p: any) => p.player_id)
      .filter((playerId: string | undefined) => Boolean(playerId) && playerId !== tournament.organizer_id) as string[];

    if (playerIds.length < 2) {
      throw new Error('At least 2 approved players are required to generate a bracket.');
    }
    if (playerIds.length > tournament.max_players) {
      throw new Error('Approved players exceed the tournament limit.');
    }

    const slotMinutes = tournament.slot_minutes || 90;
    const startTime = tournament.start_time || new Date().toISOString();
    let matchesToInsert: any[] = [];

    if (tournament.format === 'round_robin' || tournament.format === 'league') {
      matchesToInsert = buildRoundRobinMatches(playerIds, tournamentId, startTime, slotMinutes, tournament.format === 'league' ? 0 : 0);
    } else if (tournament.format === 'group_stage') {
      matchesToInsert = buildGroupStageMatches(playerIds, tournamentId, startTime, slotMinutes);
    } else if (tournament.format === 'double_elimination') {
      matchesToInsert = buildDoubleEliminationMatches(playerIds, tournamentId, startTime, slotMinutes);
    } else {
      matchesToInsert = buildSingleEliminationMatches(playerIds, tournamentId, startTime, slotMinutes);
    }

    const { data: insertedMatches, error: insertError } = await supabase
      .from('matches')
      .insert(matchesToInsert)
      .select();

    if (insertError) {
      const message = (insertError.message || '').toLowerCase();
      if (insertError.code === '42501' || message.includes('row-level security') || message.includes('forbidden')) {
        throw new Error('Supabase blocked bracket creation because the matches table write policy is not allowing inserts. Run the SQL policy fix in Supabase, then try again.');
      }
      throw insertError;
    }

    await supabase
      .from('tournaments')
      .update({ status: 'active', auto_lock_registration: true, updated_at: new Date().toISOString() })
      .eq('id', tournamentId);

    const notificationsToInsert = playerIds.map(playerId => ({
      user_id: playerId,
      title: 'Bracket Generated!',
      content: 'The tournament bracket has been created. Check your assigned matches.',
      link: `/tournaments/${tournamentId}`,
      is_read: false
    }));

    if (notificationsToInsert.length) {
      await supabase.from('notifications').insert(notificationsToInsert);
    }

    return (insertedMatches || matchesToInsert) as Match[];
  },

  submitMatchResult: async (matchId: string, player1_score: number, player2_score: number, proofUrl: string, submittedBy: string): Promise<MatchResult> => {
    assertSupabase();

    const { data: existing } = await supabase
      .from('match_results')
      .select('*')
      .eq('match_id', matchId)
      .eq('submitted_by', submittedBy)
      .maybeSingle();

    let result;

    if (existing) {
      const { data, error } = await supabase
        .from('match_results')
        .update({
          player1_score,
          player2_score,
          proof_url: proofUrl,
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('The score report update could not be saved.');
      result = data;
    } else {
      const { data, error } = await supabase
        .from('match_results')
        .insert([{ match_id: matchId, player1_score, player2_score, proof_url: proofUrl, submitted_by: submittedBy, status: 'pending' }])
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('The score report could not be created.');
      result = data;
    }

    const { data: match, error: matchError } = await supabase
      .from('matches')
      .update({ status: 'disputed', updated_at: new Date().toISOString() })
      .eq('id', matchId)
      .select()
      .maybeSingle();

    if (matchError) throw matchError;
    if (!match) throw new Error('The selected match could not be updated.');

    if (match) {
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('title, organizer_id')
        .eq('id', match.tournament_id)
        .maybeSingle();

      if (tournament) {
        await supabase.from('notifications').insert({
          user_id: tournament.organizer_id,
          title: 'Match Result Submitted',
          content: `A match score report has been submitted for match #${match.match_no} in "${tournament.title}". Verification required.`,
          link: `/tournaments/${match.tournament_id}`,
          is_read: false
        });
      }
    }

    await db.earnAchievement(submittedBy, 'Veracious Reporter');

    await supabase.from('activity_logs').insert({
      user_id: submittedBy,
      action_type: 'SCORE_SUBMIT',
      description: `Submitted score reporting (${player1_score}-${player2_score})`
    });

    return result as MatchResult;
  },

  verifyMatchResult: async (matchId: string, winnerId: string, p1Score: number, p2Score: number): Promise<Match> => {
    assertSupabase();

    const { data: match, error: matchError } = await supabase
      .from('matches')
      .update({
        player1_score: p1Score,
        player2_score: p2Score,
        winner_id: winnerId,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', matchId)
      .select()
      .maybeSingle();

    if (matchError || !match) throw matchError || new Error('Failed to update match');

    await supabase.from('activity_logs').insert({
      user_id: winnerId,
      action_type: 'MATCH_WIN',
      description: 'Won match against opponent'
    });

    await db.earnAchievement(winnerId, 'First Victory');

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('game_id')
      .eq('id', match.tournament_id)
      .maybeSingle();

    if (tournament) {
      const updateStats = async (userId: string, won: boolean) => {
        const { data: stats } = await supabase
          .from('player_statistics')
          .select('*')
          .eq('user_id', userId)
          .eq('game_id', tournament.game_id)
          .maybeSingle();

        if (stats) {
          await supabase
            .from('player_statistics')
            .update({
              matches_played: (stats.matches_played || 0) + 1,
              matches_won: (stats.matches_won || 0) + (won ? 1 : 0),
              matches_lost: (stats.matches_lost || 0) + (won ? 0 : 1),
              updated_at: new Date().toISOString()
            })
            .eq('id', stats.id);
        } else {
          await supabase.from('player_statistics').insert({
            user_id: userId,
            game_id: tournament.game_id,
            matches_played: 1,
            matches_won: won ? 1 : 0,
            matches_lost: won ? 0 : 1,
            tournaments_played: 1,
            tournaments_won: 0,
            win_rate: won ? 100.0 : 0.0
          });
        }
      };

      if (match.player1_id) await updateStats(match.player1_id, winnerId === match.player1_id);
      if (match.player2_id) await updateStats(match.player2_id, winnerId === match.player2_id);
    }

    if (match.next_match_id) {
      const { data: nextMatch } = await supabase
        .from('matches')
        .select('*')
        .eq('id', match.next_match_id)
        .maybeSingle();

      if (nextMatch) {
        const updates: any = { updated_at: new Date().toISOString() };
        if (!nextMatch.player1_id) {
          updates.player1_id = winnerId;
        } else if (!nextMatch.player2_id) {
          updates.player2_id = winnerId;
        }
        if ((nextMatch.player1_id || updates.player1_id) && (nextMatch.player2_id || updates.player2_id)) {
          updates.status = 'playing';
        }
        await supabase.from('matches').update(updates).eq('id', match.next_match_id);
      }
    } else {
      await db.updateTournamentStatus(match.tournament_id, 'completed', winnerId);
    }

    await supabase
      .from('match_results')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('match_id', matchId);

    if (winnerId && tournament?.game_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', winnerId)
        .maybeSingle();

      await awardRankPoints(winnerId, tournament.game_id, 100, 'Verified match win', profile?.username, profile?.avatar_url);
    }

    return match as Match;
  },

  rescheduleMatch: async (matchId: string, newScheduledTime: string | null): Promise<Match> => {
    assertSupabase();
    if (!isUuid(matchId)) throw new Error('Invalid match id.');

    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();
    if (matchError || !match) throw matchError || new Error('Match not found.');

    const { data: updated, error: updateError } = await supabase
      .from('matches')
      .update({ scheduled_time: newScheduledTime, updated_at: new Date().toISOString() })
      .eq('id', matchId)
      .select()
      .maybeSingle();

    if (updateError || !updated) throw updateError || new Error('Failed to reschedule match.');

    if (match.next_match_id) {
      const { data: nextMatch } = await supabase
        .from('matches')
        .select('*')
        .eq('id', match.next_match_id)
        .maybeSingle();

      if (nextMatch) {
        const thisTime = newScheduledTime ? new Date(newScheduledTime).getTime() : null;
        const nextTime = nextMatch.scheduled_time ? new Date(nextMatch.scheduled_time).getTime() : null;
        if (thisTime && (!nextTime || nextTime <= thisTime)) {
          const shiftedTime = new Date(thisTime + 2 * 60 * 60 * 1000).toISOString();
          await supabase
            .from('matches')
            .update({ scheduled_time: shiftedTime, updated_at: new Date().toISOString() })
            .eq('id', nextMatch.id);
        }
      }
    }

    const participantIds = [match.player1_id, match.player2_id].filter(Boolean) as string[];
    if (participantIds.length) {
      const notifications = participantIds.map((uid) => ({
        user_id: uid,
        title: 'Match rescheduled',
        content: `A match you are in was rescheduled to ${newScheduledTime ? new Date(newScheduledTime).toLocaleString() : 'TBD'}.`,
        link: `/tournaments/${match.tournament_id}`,
        is_read: false
      }));
      await supabase.from('notifications').insert(notifications);
    }

    return updated as Match;
  },

  generateSchedule: async (tournamentId: string, opts: { start_time?: string; slot_minutes?: number } = {}): Promise<Match[]> => {
    assertSupabase();
    if (!isUuid(tournamentId)) throw new Error('Invalid tournament id.');

    const { data: tournament, error: tError } = await supabase
      .from('tournaments')
      .select('start_time')
      .eq('id', tournamentId)
      .maybeSingle();
    if (tError) throw tError;

    const start = opts.start_time || tournament?.start_time || new Date().toISOString();
    const slotMinutes = opts.slot_minutes || 120;

    const { data: matches, error: mErr } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_no', { ascending: true })
      .order('match_no', { ascending: true });
    if (mErr) throw mErr;

    let cursor = new Date(start).getTime();
    const updatedMatches: Match[] = [];

    for (const match of (matches || []) as Match[]) {
      if (!match.scheduled_time) {
        const scheduled = new Date(cursor).toISOString();
        const { data: updated } = await supabase
          .from('matches')
          .update({ scheduled_time: scheduled, updated_at: new Date().toISOString() })
          .eq('id', match.id)
          .select()
          .maybeSingle();
        if (updated) updatedMatches.push(updated as Match);
        cursor += slotMinutes * 60 * 1000;
      }
    }

    return updatedMatches;
  },

  createFriendChallenge: async (hostId: string, opponentId: string, opponentName: string, gameId: string, title: string): Promise<FriendChallenge> => {
    assertSupabase();
    if (!isUuid(hostId)) throw new Error('Host id must be a valid UUID.');
    if (!isUuid(opponentId)) throw new Error('Opponent id must be a valid UUID.');
    if (!isUuid(gameId)) throw new Error('Game id must be a valid UUID.');

    const { data, error } = await supabase
      .from('friend_challenges')
      .insert([{ host_id: hostId, opponent_id: opponentId, opponent_name: opponentName, game_id: gameId, title: title || 'Friendly challenge', status: 'pending', integrity_status: 'pending' }])
      .select()
      .maybeSingle();

    if (error || !data) throw error || new Error('Failed to create friend challenge.');

    await supabase.from('notifications').insert([
      {
        user_id: hostId,
        title: 'Friend challenge created',
        content: `You invited ${opponentName || 'a friend'} to a friendly match.`,
        link: '/friendly',
        is_read: false
      },
      {
        user_id: opponentId,
        title: 'New friendly challenge',
        content: `${opponentName || 'A friend'} has invited you to a friendly match.`,
        link: '/friendly',
        is_read: false
      }
    ]);

    return data as FriendChallenge;
  },

  acceptFriendChallenge: async (challengeId: string, opponentId: string): Promise<FriendChallenge> => {
    assertSupabase();
    // verify active session and that the requestor matches the authenticated user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('[db.acceptFriendChallenge] supabase.auth.getSession failed:', sessionError);
    }
    const sessionUserId = session?.user?.id;
    const accessTokenExists = !!session?.access_token;
    if (!accessTokenExists || !sessionUserId) {
      throw new Error('Your authentication session is missing or expired. Please sign in again and try accepting the challenge.');
    }
    if (sessionUserId !== opponentId) {
      console.error('[db.acceptFriendChallenge] Session user mismatch', { sessionUserId, opponentId });
      throw new Error('You are not authorized to accept this challenge. Please sign in with the correct account.');
    }

    const { data, error } = await supabase
      .from('friend_challenges')
      .update({ status: 'accepted', opponent_id: opponentId, updated_at: new Date().toISOString() })
      .eq('id', challengeId)
      .select()
      .maybeSingle();

    if (error || !data) throw error || new Error('Failed to accept friend challenge');

    await supabase.from('notifications').insert({
      user_id: data.host_id,
      title: 'Friendly challenge accepted',
      content: `${data.opponent_name || 'Your opponent'} accepted your friendly match request.`,
      link: '/friendly',
      is_read: false
    });

    return data as FriendChallenge;
  },

  submitFriendChallengeResult: async (challengeId: string, userId: string, hostScore: number, opponentScore: number, proofUrl: string): Promise<FriendChallenge> => {
    assertSupabase();

    const { data: challenge, error } = await supabase
      .from('friend_challenges')
      .select('*')
      .eq('id', challengeId)
      .maybeSingle();

    if (error || !challenge) throw error || new Error('Challenge not found');

    const winnerId = hostScore > opponentScore ? challenge.host_id : opponentScore > hostScore ? challenge.opponent_id || challenge.host_id : undefined;
    const updates: any = {
      host_score: hostScore,
      opponent_score: opponentScore,
      proof_url: proofUrl,
      updated_at: new Date().toISOString(),
      status: 'accepted',
      integrity_status: 'pending'
    };

    if (proofUrl && hostScore !== opponentScore && winnerId) {
      updates.integrity_status = 'verified';
      updates.points_awarded = 120;
      updates.verified_by = userId;
      updates.status = 'completed';
      await awardRankPoints(winnerId, challenge.game_id, 120, 'Friendly match win');
    } else {
      updates.integrity_status = 'flagged';
      updates.status = 'flagged';
    }

    const { data: updatedChallenge, error: updateError } = await supabase
      .from('friend_challenges')
      .update(updates)
      .eq('id', challengeId)
      .select()
      .maybeSingle();

    if (updateError || !updatedChallenge) throw updateError || new Error('Failed to update challenge result');
    return updatedChallenge as FriendChallenge;
  },

  getFriendChallenges: async (): Promise<FriendChallenge[]> => {
    assertSupabase();
    const { data, error } = await supabase.from('friend_challenges').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data as FriendChallenge[];
  },

  getAcceptedFriendIds: async (userId: string): Promise<string[]> => {
    assertSupabase();
    const { data, error } = await supabase
      .from('friendships')
      .select('requester_id,addressee_id')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq('status', 'accepted');
    if (error) throw error;
    return (data || [])
      .map((row: any) => (row.requester_id === userId ? row.addressee_id : row.requester_id))
      .filter(isUuid);
  },

  getFriendships: async (userId: string): Promise<Friendship[]> => {
    assertSupabase();
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Friendship[];
    } catch (err: any) {
      const msg = (err && err.message) || String(err);
      if (/friendships/.test(msg) && /(does not exist|Could not find the table|schema cache)/i.test(msg)) {
        console.warn('[db.getFriendships] Friendships table missing, returning empty list:', msg);
        return [];
      }
      throw err;
    }
  },

  sendFriendRequest: async (requesterId: string, addresseeId: string): Promise<Friendship> => {
    assertSupabase();
    if (requesterId === addresseeId) throw new Error('You cannot add yourself as a friend.');

    // Use the authenticated Supabase user as one side of the friendship to satisfy RLS
    const authUser = await getSupabaseAuthUser();
    // Ensure there is an active session/access token so RLS can validate auth.uid()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('[db.sendFriendRequest] supabase.auth.getSession failed:', sessionError);
    }

    const sessionUserId = session?.user?.id;
    const accessTokenExists = !!session?.access_token;
    if (!accessTokenExists || !sessionUserId) {
      throw new Error('Your authentication session is missing or expired. Please sign in again and try adding the friend.');
    }

    if (sessionUserId !== authUser.id) {
      console.error('[db.sendFriendRequest] Supabase session user does not match authenticated user', { sessionUserId, authUserId: authUser.id });
      throw new Error('Authentication mismatch detected. Please sign in again.');
    }
    if (!authUser?.id) throw new Error('No authenticated user available for sending friend request. Please sign in.');

    const userA = authUser.id;
    const otherId = addresseeId === userA ? requesterId : addresseeId;

    const requesterA = userA < otherId ? userA : otherId;
    const addresseeA = userA < otherId ? otherId : userA;

    try {
      const { data: existing, error: existingError } = await supabase
        .from('friendships')
        .select('*')
        .eq('requester_id', requesterA)
        .eq('addressee_id', addresseeA)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) return existing as Friendship;
    } catch (err: any) {
      const msg = (err && err.message) || String(err);
      if (/friendships/.test(msg) && /(does not exist|Could not find the table|schema cache)/i.test(msg)) {
        throw new Error('Friendships table is missing in the database. Run the migrations to create it.');
      }
      throw err;
    }

    try {
      const { data, error } = await supabase
        .from('friendships')
        .insert([{ requester_id: requesterA, addressee_id: addresseeA, status: 'pending' }])
        .select()
        .maybeSingle();

      if (error || !data) throw error || new Error('Failed to send friend request.');

      await supabase.from('notifications').insert({
        user_id: otherId,
        title: 'New friend request',
        content: 'A player wants to add you as a friend.',
        link: '/friends',
        is_read: false
      });

      return data as Friendship;
    } catch (err: any) {
      const msg = (err && err.message) || String(err);
      if (/friendships/.test(msg) && /(does not exist|Could not find the table|schema cache)/i.test(msg)) {
        throw new Error('Friendships table is missing in the database. Run the migrations to create it.');
      }
      throw err;
    }
  },

  updateFriendshipStatus: async (friendshipId: string, status: Friendship['status']): Promise<Friendship> => {
    assertSupabase();
    try {
      const { data, error } = await supabase
        .from('friendships')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', friendshipId)
        .select()
        .maybeSingle();
      if (error || !data) throw error || new Error('Failed to update friend request.');
      return data as Friendship;
    } catch (err: any) {
      const msg = (err && err.message) || String(err);
      if (/friendships/.test(msg) && /(does not exist|Could not find the table|schema cache)/i.test(msg)) {
        throw new Error('Friendships table is missing in the database. Run the migrations to create it.');
      }
      throw err;
    }
  },

  removeFriendship: async (friendshipId: string): Promise<void> => {
    assertSupabase();
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
      if (error) throw error;
    } catch (err: any) {
      const msg = (err && err.message) || String(err);
      if (/friendships/.test(msg) && /(does not exist|Could not find the table|schema cache)/i.test(msg)) {
        throw new Error('Friendships table is missing in the database. Run the migrations to create it.');
      }
      throw err;
    }
  },

  getLeaderboard: async (gameId: string): Promise<Leaderboard[]> => {
    assertSupabase();
    const { data, error } = await supabase
      .from('leaderboards')
      .select('*, profiles(username, avatar_url)')
      .eq('game_id', gameId)
      .order('rank_points', { ascending: false });

    if (error) throw error;
    return (data || []).map((item: any) => ({
      ...item,
      username: item.profiles?.username,
      avatar_url: item.profiles?.avatar_url
    })) as Leaderboard[];
  },

  getTournamentLeaderboard: async (tournamentId: string): Promise<Leaderboard[]> => {
    assertSupabase();
    const tournament = await db.getTournament(tournamentId);
    if (!tournament) return [];

    const { data: playerIdsData, error: playersError } = await supabase
      .from('tournament_players')
      .select('player_id')
      .eq('tournament_id', tournamentId)
      .eq('status', 'approved');

    if (playersError) throw playersError;

    const playerIds = (playerIdsData || []).map((p: any) => p.player_id);
    if (!playerIds.length) return [];

    const { data, error } = await supabase
      .from('leaderboards')
      .select('*, profiles(username, avatar_url)')
      .in('user_id', playerIds)
      .eq('game_id', tournament.game_id)
      .order('rank_points', { ascending: false });

    if (error) throw error;
    return (data || []).map((item: any) => ({
      ...item,
      username: item.profiles?.username,
      avatar_url: item.profiles?.avatar_url
    })) as Leaderboard[];
  },

  getOverallLeaderboard: async (): Promise<Leaderboard[]> => {
    assertSupabase();
    const { data, error } = await supabase
      .from('leaderboards')
      .select('*, profiles(username, avatar_url)');

    if (error) throw error;

    const grouped = new Map<string, Leaderboard>();
    for (const item of (data || []) as any[]) {
      const existing = grouped.get(item.user_id);
      if (existing) {
        existing.rank_points += item.rank_points;
      } else {
        grouped.set(item.user_id, {
          ...item,
          game_id: 'overall',
          username: item.profiles?.username,
          avatar_url: item.profiles?.avatar_url
        } as Leaderboard);
      }
    }
    return Array.from(grouped.values()).sort((a, b) => b.rank_points - a.rank_points);
  },

  getPlayerStats: async (userId: string): Promise<PlayerStatistics[]> => {
    assertSupabase();
    const { data, error } = await supabase
      .from('player_statistics')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data as PlayerStatistics[];
  },

  getNotifications: async (userId: string): Promise<Notification[]> => {
    assertSupabase();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Notification[];
  },

  markNotificationAsRead: async (id: string): Promise<void> => {
    assertSupabase();
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
  },

  getAchievements: async (): Promise<Achievement[]> => {
    assertSupabase();
    const { data, error } = await supabase.from('achievements').select('*');
    if (error) throw error;
    return data as Achievement[];
  },

  getUserAchievements: async (userId: string): Promise<UserAchievement[]> => {
    assertSupabase();
    const { data, error } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data as UserAchievement[];
  },

  getSettings: async (userId: string): Promise<Settings> => {
    assertSupabase();
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[db.getSettings] Failed to read settings, returning defaults:', error.message || error);
      return {
        id: '',
        user_id: userId,
        push_notifications: true,
        email_notifications: true,
        public_profile: true,
        dark_mode: true,
        show_email: false,
        allow_dms: true
      } as Settings;
    }

    return (data as Settings) || {
      id: '',
      user_id: userId,
      push_notifications: true,
      email_notifications: true,
      public_profile: true,
      dark_mode: true,
      show_email: false,
      allow_dms: true
    };
  },
  updateSettings: async (userId: string, updates: Partial<Settings>): Promise<Settings> => {
    assertSupabase();
    try {
      const { data, error } = await supabase
        .from('settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (data) return data as Settings;

      // If no settings row existed yet, create one with the requested fields.
      const { data: insertedData, error: insertError } = await supabase
        .from('settings')
        .insert({ user_id: userId, ...updates, updated_at: new Date().toISOString() })
        .select()
        .maybeSingle();

      if (insertError || !insertedData) throw insertError || new Error('Failed to create settings row');
      return insertedData as Settings;
    } catch (err: any) {
      const msg = (err && err.message) || String(err);
      // If the error is caused by missing columns, attempt a fallback update without those fields
      if (/column\s+"anonymous_mode"\s+does not exist/i.test(msg) || /column\s+"allow_dms"\s+does not exist/i.test(msg) || /column\s+"show_email"\s+does not exist/i.test(msg)) {
        console.warn('[db.updateSettings] Schema missing some columns, retrying without unknown fields:', msg);
        const safeUpdates: any = { ...updates };
        delete safeUpdates.anonymous_mode;
        delete safeUpdates.allow_dms;
        delete safeUpdates.show_email;

        const { data: data2, error: error2 } = await supabase
          .from('settings')
          .update({ ...safeUpdates, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .select()
          .maybeSingle();

        if (error2) {
          throw error2 || new Error('Failed to update settings (fallback)');
        }

        if (data2) return data2 as Settings;

        const { data: insertedData2, error: insertError2 } = await supabase
          .from('settings')
          .insert({ user_id: userId, ...safeUpdates, updated_at: new Date().toISOString() })
          .select()
          .maybeSingle();

        if (insertError2 || !insertedData2) throw insertError2 || new Error('Failed to create settings row (fallback)');
        return insertedData2 as Settings;
      }
      throw err;
    }
  },

  getActivityLogs: async (userId: string): Promise<ActivityLog[]> => {
    assertSupabase();
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as ActivityLog[];
  },

  getChatMessages: async (tournamentId: string): Promise<ChatMessage[]> => {
    assertSupabase();
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data as ChatMessage[];
  },

  getReactionsForChannel: async (channelId: string, messageIds?: string[]): Promise<Record<string, Record<string, { count: number; byUser: string[] }>>> => {
    assertSupabase();
    let query = supabase.from('chat_reactions').select('message_id, emoji, user_id');
    if (messageIds && messageIds.length > 0) query = query.in('message_id', messageIds);
    const { data, error } = await query;
    if (error) throw error;
    const result: Record<string, Record<string, { count: number; byUser: string[] }>> = {};
    for (const row of (data || []) as any[]) {
      const mid = row.message_id;
      const emoji = row.emoji;
      if (!result[mid]) result[mid] = {};
      if (!result[mid][emoji]) result[mid][emoji] = { count: 0, byUser: [] };
      result[mid][emoji].count += 1;
      result[mid][emoji].byUser.push(row.user_id);
    }
    return result;
  },

  toggleChatReaction: async (messageId: string, userId: string, emoji: string): Promise<void> => {
    assertSupabase();
    // Check if exists
    const { data: existing, error: existingError } = await supabase
      .from('chat_reactions')
      .select('*')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      const { error } = await supabase.from('chat_reactions').delete().eq('id', existing.id);
      if (error) throw error;
      return;
    }
    const { error } = await supabase.from('chat_reactions').insert([{ message_id: messageId, user_id: userId, emoji }]);
    if (error) throw error;
  },

  setTyping: async (channelId: string, userId: string): Promise<void> => {
    assertSupabase();
    await supabase.from('chat_typing').upsert({ channel_id: channelId, user_id: userId, last_typing_at: new Date().toISOString() }, { onConflict: 'channel_id,user_id' });
  },

  getTypingUsers: async (channelId: string): Promise<string[]> => {
    assertSupabase();
    const cutoff = new Date(Date.now() - 8000).toISOString();
    const { data, error } = await supabase.from('chat_typing').select('user_id').eq('channel_id', channelId).gte('last_typing_at', cutoff);
    if (error) throw error;
    return (data || []).map((r: any) => r.user_id) as string[];
  },

  sendChatMessage: async (tournamentId: string, userId: string, username: string, avatarUrl: string, content: string): Promise<ChatMessage> => {
    assertSupabase();

    const dmParticipants = getDmParticipantIds(tournamentId);
    if (dmParticipants.length === 2) {
      if (!dmParticipants.includes(userId)) {
        throw new Error('You are not a participant in this DM.');
      }

      const recipientId = dmParticipants.find(id => id !== userId)!;
      let canDm = true;
      try {
        const { data: recipientSettings, error: settingsError } = await supabase
          .from('settings')
          .select('allow_dms')
          .eq('user_id', recipientId)
          .maybeSingle();

        if (settingsError) throw settingsError;
        canDm = recipientSettings?.allow_dms !== false || await usersAreFriends(userId, recipientId);
      } catch (err) {
        console.warn('[db.sendChatMessage] Failed to read recipient settings, assuming DMs allowed:', err);
        // If the settings schema is out-of-sync (missing column), don't block DMs — assume allowed.
        canDm = true;
      }

      if (!canDm) {
        throw new Error('This player only accepts DMs from friends.');
      }
    }

    const { data, error } = await supabase
      .from('chats')
      .insert([{ tournament_id: tournamentId, user_id: userId, username, avatar_url: avatarUrl, content }])
      .select()
      .maybeSingle();
    if (error || !data) throw error || new Error('Failed to send chat message');
    return data as ChatMessage;
  },

  markChatRead: async (channelId: string, userId: string): Promise<void> => {
    assertSupabase();
    await supabase
      .from('chat_reads')
      .upsert({
        channel_id: channelId,
        user_id: userId,
        last_read_at: new Date().toISOString()
      }, { onConflict: 'channel_id,user_id' });
  },

  deleteChatMessage: async (messageId: string): Promise<void> => {
    assertSupabase();
    const { error } = await supabase.from('chats').delete().eq('id', messageId);
    if (error) throw error;
  },

  getUnreadDmCount: async (userId: string): Promise<number> => {
    assertSupabase();

    const { data: reads, error: readsError } = await supabase
      .from('chat_reads')
      .select('channel_id, last_read_at')
      .eq('user_id', userId);
    if (readsError) throw readsError;

    const readMap = new Map((reads || []).map((read: any) => [read.channel_id, read.last_read_at]));
    const { data: messages, error: messagesError } = await supabase
      .from('chats')
      .select('tournament_id, created_at, user_id')
      .neq('user_id', userId)
      .like('tournament_id', `dm:%${userId}%`);

    if (messagesError) throw messagesError;

    return (messages || []).filter((message: any) => {
      const participants = getDmParticipantIds(message.tournament_id);
      if (!participants.includes(userId)) return false;
      const lastReadAt = readMap.get(message.tournament_id);
      return !lastReadAt || new Date(message.created_at).getTime() > new Date(lastReadAt).getTime();
    }).length;
  }
};
