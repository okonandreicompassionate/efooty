import { supabase, isSupabaseConfigured } from '../supabase';
import { 
  Profile, Game, Tournament, TournamentPlayer, Match, 
  MatchResult, Notification, Achievement, Leaderboard, 
  PlayerStatistics, ActivityLog, Settings, UserRole,
  TournamentStatus, PlayerRegistrationStatus, UserAchievement,
  ChatMessage
} from '../types';

// ==========================================
// MOCK SEED DATA FOR OFFLINE SIMULATION
// ==========================================

const MOCK_GAMES: Game[] = [
  { id: 'g1', name: 'eFootball 2026', slug: 'efootball', icon: 'Gamepad2', cover_image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=60', created_at: new Date().toISOString() },
  { id: 'g2', name: 'EA SPORTS FC 26', slug: 'ea-fc', icon: 'Trophy', cover_image: 'https://images.unsplash.com/photo-1540747737956-37872404a82f?w=800&auto=format&fit=crop&q=60', created_at: new Date().toISOString() },
  { id: 'g3', name: 'Valorant', slug: 'valorant', icon: 'Crosshair', cover_image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=60', created_at: new Date().toISOString() },
  { id: 'g4', name: 'Tekken 8', slug: 'tekken-8', icon: 'Sword', cover_image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=60', created_at: new Date().toISOString() },
  { id: 'g5', name: 'Mortal Kombat 1', slug: 'mortal-kombat-1', icon: 'Flame', cover_image: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800&auto=format&fit=crop&q=60', created_at: new Date().toISOString() }
];

const MOCK_PROFILES: Profile[] = [
  { id: 'u-admin', username: 'OkonAdmin', email: 'okoncompassionate@gmail.com', role: 'admin', bio: 'Senior Product Designer and Lead Developer of KickOff.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=okon', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-org1', username: 'ApexOrganizer', email: 'apex_org@kickoff.gg', role: 'organizer', bio: 'Veteran esports host with 5+ years of experience.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=apex', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-org2', username: 'ESL_Host', email: 'esl@kickoff.gg', role: 'organizer', bio: 'Hosting the best regional fighting game brackets.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=esl', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  // Players
  { id: 'u-p1', username: 'Xenon', email: 'xenon@kickoff.gg', role: 'player', bio: 'FPS specialist and Valorant Radiant player.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=xenon', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-p2', username: 'ApexPredator', email: 'apex@kickoff.gg', role: 'player', bio: 'eFootball Division 1 top 100.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=apexpred', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-p3', username: 'StormBreaker', email: 'storm@kickoff.gg', role: 'player', bio: 'EA FC competitor.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=storm', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-p4', username: 'ShadowStrike', email: 'shadow@kickoff.gg', role: 'player', bio: 'Tekken 8 Jin main.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=shadow', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-p5', username: 'GlitchGG', email: 'glitch@kickoff.gg', role: 'player', bio: 'Mortal Kombat Scorpion loyalist.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=glitch', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-p6', username: 'Cipher', email: 'cipher@kickoff.gg', role: 'player', bio: 'Play to win.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=cipher', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-p7', username: 'Viper_Striker', email: 'viper@kickoff.gg', role: 'player', bio: 'EA FC enthusiast.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=viper', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-p8', username: 'PixelKing', email: 'pixel@kickoff.gg', role: 'player', bio: 'Fighter game professional.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=pixel', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-p9', username: 'QuantumFlux', email: 'quantum@kickoff.gg', role: 'player', bio: 'Always adapting.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=quantum', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-p10', username: 'VoltFighter', email: 'volt@kickoff.gg', role: 'player', bio: 'Tekken is life.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=volt', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-p11', username: 'AlphaElite', email: 'alpha@kickoff.gg', role: 'player', bio: 'eFootball tactical wizard.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=alpha', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-p12', username: 'SpectreGaming', email: 'spectre@kickoff.gg', role: 'player', bio: 'Silent but deadly.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=spectre', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-p13', username: 'RiftWalker', email: 'rift@kickoff.gg', role: 'player', bio: 'Valorant Sentinel main.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=rift', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-p14', username: 'NovaFlares', email: 'nova@kickoff.gg', role: 'player', bio: 'eFootball competitive squad.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=nova', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-p15', username: 'ZephyrWind', email: 'zephyr@kickoff.gg', role: 'player', bio: 'FGC player from EU.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=zephyr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'u-p16', username: 'OnyxBeast', email: 'onyx@kickoff.gg', role: 'player', bio: 'Heavy hitter.', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=onyx', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

const MOCK_ACHIEVEMENTS: Achievement[] = [
  { id: 'ac1', name: 'First Victory', description: 'Win your first tournament match', badge_icon: 'Award', xp_reward: 100 },
  { id: 'ac2', name: 'Flawless Win', description: 'Win a match without conceding a single round/score', badge_icon: 'Zap', xp_reward: 150 },
  { id: 'ac3', name: 'Champion Ascent', description: 'Win a KickOff grand championship tournament', badge_icon: 'Trophy', xp_reward: 500 },
  { id: 'ac4', name: 'Tournament Spree', description: 'Register for 5 separate tournaments', badge_icon: 'Flame', xp_reward: 200 },
  { id: 'ac5', name: 'Veracious Reporter', description: 'Submit tournament scores with verified screenshots', badge_icon: 'Shield', xp_reward: 100 }
];

// Seed 3 tournaments
const MOCK_TOURNAMENTS: Tournament[] = [
  {
    id: 't1',
    title: 'eFootball Pro Championship 2026',
    description: 'The ultimate eFootball tournament for regional Division 1 players. Fight for glory and cash prizes.',
    game_id: 'g1',
    organizer_id: 'u-org1',
    banner_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&auto=format&fit=crop&q=80',
    max_players: 8,
    status: 'registration',
    start_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
    format: 'single_elimination',
    prize_pool: '$5,000 USD',
    rules: '1. Matches are 10 minutes in game time.\n2. In case of draw, Extra Time and Penalties apply.\n3. Toxic behavior leads to immediate disqualification.\n4. Results must be submitted within 15 minutes of match completion.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 't2',
    title: 'EA FC 26 Super Cup',
    description: 'Enter the pitch and prove you are the best EA Sports FC player in the community.',
    game_id: 'g2',
    organizer_id: 'u-org1',
    banner_url: 'https://images.unsplash.com/photo-1540747737956-37872404a82f?w=1200&auto=format&fit=crop&q=80',
    max_players: 8,
    status: 'active',
    start_time: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    format: 'single_elimination',
    prize_pool: '$2,500 USD',
    rules: 'Standard Ultimate Team squads permitted. Match length: 6 minutes halves.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 't3',
    title: 'Tekken 8 Iron Fist Bracket',
    description: 'Ready to throw down? The ultimate community bracket for Tekken 8. Open to all ranks.',
    game_id: 'g4',
    organizer_id: 'u-org2',
    banner_url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&auto=format&fit=crop&q=80',
    max_players: 8,
    status: 'completed',
    start_time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    format: 'single_elimination',
    prize_pool: '$1,000 USD + Gaming Chair',
    rules: 'Standard tournament match configurations. 3 rounds of 60 seconds per set.',
    winner_id: 'u-p4', // ShadowStrike
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Seed registrations for t1 (registration stage) and t2 (active stage) and t3 (completed stage)
const MOCK_TOURNAMENT_PLAYERS: TournamentPlayer[] = [
  // registrations for Tournament 1 (eFootball) - 6 approved, 2 pending
  { id: 'tp-1-1', tournament_id: 't1', player_id: 'u-admin', status: 'approved', seed_no: 1, created_at: new Date().toISOString() },
  { id: 'tp-1-2', tournament_id: 't1', player_id: 'u-p2', status: 'approved', seed_no: 2, created_at: new Date().toISOString() },
  { id: 'tp-1-3', tournament_id: 't1', player_id: 'u-p3', status: 'approved', seed_no: 3, created_at: new Date().toISOString() },
  { id: 'tp-1-4', tournament_id: 't1', player_id: 'u-p11', status: 'approved', seed_no: 4, created_at: new Date().toISOString() },
  { id: 'tp-1-5', tournament_id: 't1', player_id: 'u-p14', status: 'approved', seed_no: 5, created_at: new Date().toISOString() },
  { id: 'tp-1-6', tournament_id: 't1', player_id: 'u-p6', status: 'approved', seed_no: 6, created_at: new Date().toISOString() },
  { id: 'tp-1-7', tournament_id: 't1', player_id: 'u-p7', status: 'pending', created_at: new Date().toISOString() },
  { id: 'tp-1-8', tournament_id: 't1', player_id: 'u-p8', status: 'pending', created_at: new Date().toISOString() },

  // registrations for Tournament 2 (EA FC) - 8 approved (active tournament, bracket generated)
  { id: 'tp-2-1', tournament_id: 't2', player_id: 'u-admin', status: 'approved', seed_no: 1, created_at: new Date().toISOString() },
  { id: 'tp-2-2', tournament_id: 't2', player_id: 'u-p2', status: 'approved', seed_no: 2, created_at: new Date().toISOString() },
  { id: 'tp-2-3', tournament_id: 't2', player_id: 'u-p3', status: 'approved', seed_no: 3, created_at: new Date().toISOString() },
  { id: 'tp-2-4', tournament_id: 't2', player_id: 'u-p7', status: 'approved', seed_no: 4, created_at: new Date().toISOString() },
  { id: 'tp-2-5', tournament_id: 't2', player_id: 'u-p8', status: 'approved', seed_no: 5, created_at: new Date().toISOString() },
  { id: 'tp-2-6', tournament_id: 't2', player_id: 'u-p9', status: 'approved', seed_no: 6, created_at: new Date().toISOString() },
  { id: 'tp-2-7', tournament_id: 't2', player_id: 'u-p11', status: 'approved', seed_no: 7, created_at: new Date().toISOString() },
  { id: 'tp-2-8', tournament_id: 't2', player_id: 'u-p12', status: 'approved', seed_no: 8, created_at: new Date().toISOString() },

  // registrations for Tournament 3 (Tekken 8) - 8 approved
  { id: 'tp-3-1', tournament_id: 't3', player_id: 'u-p4', status: 'approved', seed_no: 1, created_at: new Date().toISOString() },
  { id: 'tp-3-2', tournament_id: 't3', player_id: 'u-p5', status: 'approved', seed_no: 2, created_at: new Date().toISOString() },
  { id: 'tp-3-3', tournament_id: 't3', player_id: 'u-p10', status: 'approved', seed_no: 3, created_at: new Date().toISOString() },
  { id: 'tp-3-4', tournament_id: 't3', player_id: 'u-p15', status: 'approved', seed_no: 4, created_at: new Date().toISOString() },
  { id: 'tp-3-5', tournament_id: 't3', player_id: 'u-p16', status: 'approved', seed_no: 5, created_at: new Date().toISOString() },
  { id: 'tp-3-6', tournament_id: 't3', player_id: 'u-p1', status: 'approved', seed_no: 6, created_at: new Date().toISOString() },
  { id: 'tp-3-7', tournament_id: 't3', player_id: 'u-p6', status: 'approved', seed_no: 7, created_at: new Date().toISOString() },
  { id: 'tp-3-8', tournament_id: 't3', player_id: 'u-p8', status: 'approved', seed_no: 8, created_at: new Date().toISOString() }
];

// Seed matches for t2 (active, single elimination, size 8)
// 4 matches in round 1, 2 matches in round 2, 1 match in round 3 (finals)
const MOCK_MATCHES: Match[] = [
  // --- TOURNAMENT 2 (EA FC) ---
  // Round 1
  { id: 'm-2-1', tournament_id: 't2', round_no: 1, match_no: 1, player1_id: 'u-admin', player2_id: 'u-p12', player1_score: 3, player2_score: 1, winner_id: 'u-admin', status: 'completed', next_match_id: 'm-2-5', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'm-2-2', tournament_id: 't2', round_no: 1, match_no: 2, player1_id: 'u-p2', player2_id: 'u-p11', player1_score: 0, player2_score: 2, winner_id: 'u-p11', status: 'completed', next_match_id: 'm-2-5', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'm-2-3', tournament_id: 't2', round_no: 1, match_no: 3, player1_id: 'u-p3', player2_id: 'u-p9', player1_score: 0, player2_score: 0, winner_id: undefined, status: 'playing', next_match_id: 'm-2-6', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'm-2-4', tournament_id: 't2', round_no: 1, match_no: 4, player1_id: 'u-p7', player2_id: 'u-p8', player1_score: 4, player2_score: 2, winner_id: 'u-p7', status: 'completed', next_match_id: 'm-2-6', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  // Round 2 (Semifinals)
  { id: 'm-2-5', tournament_id: 't2', round_no: 2, match_no: 1, player1_id: 'u-admin', player2_id: 'u-p11', player1_score: 0, player2_score: 0, winner_id: undefined, status: 'scheduled', next_match_id: 'm-2-7', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'm-2-6', tournament_id: 't2', round_no: 2, match_no: 2, player1_id: undefined, player2_id: 'u-p7', player1_score: 0, player2_score: 0, winner_id: undefined, status: 'waiting', next_match_id: 'm-2-7', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  // Round 3 (Finals)
  { id: 'm-2-7', tournament_id: 't2', round_no: 3, match_no: 1, player1_id: undefined, player2_id: undefined, player1_score: 0, player2_score: 0, winner_id: undefined, status: 'waiting', next_match_id: undefined, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

  // --- TOURNAMENT 3 (Tekken 8 - Completed) ---
  // Round 1
  { id: 'm-3-1', tournament_id: 't3', round_no: 1, match_no: 1, player1_id: 'u-p4', player2_id: 'u-p8', player1_score: 2, player2_score: 0, winner_id: 'u-p4', status: 'completed', next_match_id: 'm-3-5', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'm-3-2', tournament_id: 't3', round_no: 1, match_no: 2, player1_id: 'u-p5', player2_id: 'u-p6', player1_score: 2, player2_score: 1, winner_id: 'u-p5', status: 'completed', next_match_id: 'm-3-5', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'm-3-3', tournament_id: 't3', round_no: 1, match_no: 3, player1_id: 'u-p10', player2_id: 'u-p1', player1_score: 1, player2_score: 2, winner_id: 'u-p1', status: 'completed', next_match_id: 'm-3-6', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'm-3-4', tournament_id: 't3', round_no: 1, match_no: 4, player1_id: 'u-p15', player2_id: 'u-p16', player1_score: 2, player2_score: 0, winner_id: 'u-p15', status: 'completed', next_match_id: 'm-3-6', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  // Round 2
  { id: 'm-3-5', tournament_id: 't3', round_no: 2, match_no: 1, player1_id: 'u-p4', player2_id: 'u-p5', player1_score: 2, player2_score: 1, winner_id: 'u-p4', status: 'completed', next_match_id: 'm-3-7', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'm-3-6', tournament_id: 't3', round_no: 2, match_no: 2, player1_id: 'u-p1', player2_id: 'u-p15', player1_score: 0, player2_score: 2, winner_id: 'u-p15', status: 'completed', next_match_id: 'm-3-7', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  // Round 3
  { id: 'm-3-7', tournament_id: 't3', round_no: 3, match_no: 1, player1_id: 'u-p4', player2_id: 'u-p15', player1_score: 3, player2_score: 2, winner_id: 'u-p4', status: 'completed', next_match_id: undefined, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

const MOCK_MATCH_RESULTS: MatchResult[] = [
  { id: 'mr-2-1', match_id: 'm-2-1', submitted_by: 'u-admin', player1_score: 3, player2_score: 1, status: 'approved', proof_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200', created_at: new Date().toISOString() }
];

const MOCK_LEADERBOARD: Leaderboard[] = [
  { id: 'l1', user_id: 'u-p4', game_id: 'g4', rank_points: 1540, username: 'ShadowStrike', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=shadow', updated_at: new Date().toISOString() },
  { id: 'l2', user_id: 'u-p2', game_id: 'g1', rank_points: 1480, username: 'ApexPredator', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=apexpred', updated_at: new Date().toISOString() },
  { id: 'l3', user_id: 'u-admin', game_id: 'g1', rank_points: 1350, username: 'OkonAdmin', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=okon', updated_at: new Date().toISOString() },
  { id: 'l4', user_id: 'u-admin', game_id: 'g2', rank_points: 1320, username: 'OkonAdmin', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=okon', updated_at: new Date().toISOString() },
  { id: 'l5', user_id: 'u-p15', game_id: 'g4', rank_points: 1290, username: 'ZephyrWind', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=zephyr', updated_at: new Date().toISOString() },
  { id: 'l6', user_id: 'u-p11', game_id: 'g1', rank_points: 1210, username: 'AlphaElite', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=alpha', updated_at: new Date().toISOString() },
  { id: 'l7', user_id: 'u-p1', game_id: 'g3', rank_points: 1190, username: 'Xenon', avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=xenon', updated_at: new Date().toISOString() }
];

const MOCK_STATISTICS: PlayerStatistics[] = [
  { id: 's1', user_id: 'u-admin', game_id: 'g1', matches_played: 12, matches_won: 9, matches_lost: 3, tournaments_played: 3, tournaments_won: 1, win_rate: 75.0, updated_at: new Date().toISOString() },
  { id: 's2', user_id: 'u-admin', game_id: 'g2', matches_played: 8, matches_won: 5, matches_lost: 3, tournaments_played: 2, tournaments_won: 0, win_rate: 62.5, updated_at: new Date().toISOString() },
  { id: 's3', user_id: 'u-p4', game_id: 'g4', matches_played: 15, matches_won: 13, matches_lost: 2, tournaments_played: 4, tournaments_won: 2, win_rate: 86.6, updated_at: new Date().toISOString() }
];

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'n1', user_id: 'u-admin', title: 'Welcome to KickOff!', content: 'Build tournaments, challenge players, and scale the regional leaderboards.', is_read: false, created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString() },
  { id: 'n2', user_id: 'u-admin', title: 'Tournament Starting Soon', content: 'Your registered tournament "eFootball Pro Championship" starts in 2 days.', link: '/tournaments/t1', is_read: false, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() }
];

const MOCK_LOGS: ActivityLog[] = [
  { id: 'log1', user_id: 'u-admin', action_type: 'AUTH_SIGNIN', description: 'User signed in successfully', created_at: new Date().toISOString() }
];

const MOCK_SETTINGS: Settings = {
  id: 'set-admin',
  user_id: 'u-admin',
  push_notifications: true,
  email_notifications: true,
  public_profile: true,
  dark_mode: true
};

// State wrappers for simulated Storage
class StorageSimulator {
  private getStorageItem<T>(key: string, defaultValue: T): T {
    const item = localStorage.getItem(key);
    if (!item) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    return JSON.parse(item);
  }

  private setStorageItem<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  get currentUser(): Profile {
    return this.getStorageItem<Profile>('ko_current_user', MOCK_PROFILES[0]);
  }
  set currentUser(user: Profile) {
    this.setStorageItem('ko_current_user', user);
    // Sync into profiles array too
    const profiles = this.profiles;
    const index = profiles.findIndex(p => p.id === user.id);
    if (index >= 0) {
      profiles[index] = user;
      this.profiles = profiles;
    }
  }

  get profiles(): Profile[] {
    return this.getStorageItem<Profile[]>('ko_profiles', MOCK_PROFILES);
  }
  set profiles(val: Profile[]) { this.setStorageItem('ko_profiles', val); }

  get games(): Game[] {
    return this.getStorageItem<Game[]>('ko_games', MOCK_GAMES);
  }
  set games(val: Game[]) { this.setStorageItem('ko_games', val); }

  get tournaments(): Tournament[] {
    return this.getStorageItem<Tournament[]>('ko_tournaments', MOCK_TOURNAMENTS);
  }
  set tournaments(val: Tournament[]) { this.setStorageItem('ko_tournaments', val); }

  get tournamentPlayers(): TournamentPlayer[] {
    return this.getStorageItem<TournamentPlayer[]>('ko_tournament_players', MOCK_TOURNAMENT_PLAYERS);
  }
  set tournamentPlayers(val: TournamentPlayer[]) { this.setStorageItem('ko_tournament_players', val); }

  get matches(): Match[] {
    return this.getStorageItem<Match[]>('ko_matches', MOCK_MATCHES);
  }
  set matches(val: Match[]) { this.setStorageItem('ko_matches', val); }

  get matchResults(): MatchResult[] {
    return this.getStorageItem<MatchResult[]>('ko_match_results', MOCK_MATCH_RESULTS);
  }
  set matchResults(val: MatchResult[]) { this.setStorageItem('ko_match_results', val); }

  get notifications(): Notification[] {
    return this.getStorageItem<Notification[]>('ko_notifications', MOCK_NOTIFICATIONS);
  }
  set notifications(val: Notification[]) { this.setStorageItem('ko_notifications', val); }

  get leaderboards(): Leaderboard[] {
    return this.getStorageItem<Leaderboard[]>('ko_leaderboards', MOCK_LEADERBOARD);
  }
  set leaderboards(val: Leaderboard[]) { this.setStorageItem('ko_leaderboards', val); }

  get statistics(): PlayerStatistics[] {
    return this.getStorageItem<PlayerStatistics[]>('ko_statistics', MOCK_STATISTICS);
  }
  set statistics(val: PlayerStatistics[]) { this.setStorageItem('ko_statistics', val); }

  get logs(): ActivityLog[] {
    return this.getStorageItem<ActivityLog[]>('ko_logs', MOCK_LOGS);
  }
  set logs(val: ActivityLog[]) { this.setStorageItem('ko_logs', val); }

  get settings(): Settings {
    return this.getStorageItem<Settings>('ko_settings', MOCK_SETTINGS);
  }
  set settings(val: Settings) { this.setStorageItem('ko_settings', val); }

  get achievements(): Achievement[] {
    return MOCK_ACHIEVEMENTS; // Readonly achievements configuration
  }

  get userAchievements(): { user_id: string; achievement_id: string; earned_at: string }[] {
    return this.getStorageItem('ko_user_achievements', [
      { user_id: 'u-admin', achievement_id: 'ac1', earned_at: new Date().toISOString() },
      { user_id: 'u-admin', achievement_id: 'ac5', earned_at: new Date().toISOString() }
    ]);
  }
  set userAchievements(val: { user_id: string; achievement_id: string; earned_at: string }[]) {
    this.setStorageItem('ko_user_achievements', val);
  }

  get chatMessages(): ChatMessage[] {
    return this.getStorageItem<ChatMessage[]>('ko_chat_messages', [
      {
        id: 'msg-1',
        tournament_id: 'global',
        user_id: 'u-p1',
        username: 'Xenon',
        avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=xenon',
        content: 'Hey guys! Who is up for a quick Apex Legends bracket tonight?',
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'msg-2',
        tournament_id: 'global',
        user_id: 'u-admin',
        username: 'OkonAdmin',
        avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=okon',
        content: 'Welcome to KickOff! Feel free to create tournaments or join the existing active rosters.',
        created_at: new Date(Date.now() - 1800000).toISOString()
      }
    ]);
  }
  set chatMessages(val: ChatMessage[]) {
    this.setStorageItem('ko_chat_messages', val);
  }

  // Trigger achievement earning helper
  earnAchievement(userId: string, achievementId: string) {
    const arr = this.userAchievements;
    if (!arr.some(ua => ua.user_id === userId && ua.achievement_id === achievementId)) {
      arr.push({ user_id: userId, achievement_id: achievementId, earned_at: new Date().toISOString() });
      this.userAchievements = arr;

      // Add Notification
      const ach = this.achievements.find(a => a.id === achievementId);
      if (ach) {
        this.addNotification(userId, 'Achievement Unlocked!', `You have earned the "${ach.name}" badge and +${ach.xp_reward} XP!`);
      }
    }
  }

  addNotification(userId: string, title: string, content: string, link?: string) {
    const list = this.notifications;
    list.unshift({
      id: Math.random().toString(36).substring(7),
      user_id: userId,
      title,
      content,
      link,
      is_read: false,
      created_at: new Date().toISOString()
    });
    this.notifications = list;
  }

  addLog(userId: string, actionType: string, description: string) {
    const list = this.logs;
    list.unshift({
      id: Math.random().toString(36).substring(7),
      user_id: userId,
      action_type: actionType,
      description,
      created_at: new Date().toISOString()
    });
    this.logs = list;
  }
}

export const simulator = new StorageSimulator();

// ==========================================
// DUAL-MODE EXPORTED API FOR FRONTEND
// ==========================================

export const db = {
  // Authentication / Profile
  getCurrentUser: async (): Promise<Profile> => {
    if (isSupabaseConfigured && supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch public profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (profile) return profile as Profile;
      }
    }
    // Fallback to simulator
    return simulator.currentUser;
  },

  updateCurrentUserRole: async (role: UserRole): Promise<Profile> => {
    const user = simulator.currentUser;
    const updated = { ...user, role };
    simulator.currentUser = updated;
    simulator.addLog(user.id, 'ROLE_CHANGE', `Switched role to ${role}`);
    return updated;
  },

  updateUserProfile: async (id: string, updates: Partial<Profile>): Promise<Profile> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data as Profile;
    }
    
    // Offline simulation
    const profiles = simulator.profiles;
    const idx = profiles.findIndex(p => p.id === id);
    if (idx >= 0) {
      profiles[idx] = { ...profiles[idx], ...updates, updated_at: new Date().toISOString() };
      simulator.profiles = profiles;
      if (simulator.currentUser.id === id) {
        simulator.currentUser = profiles[idx];
      }
      simulator.addLog(id, 'PROFILE_UPDATE', 'Updated user profile information');
      return profiles[idx];
    }
    throw new Error('Profile not found');
  },

  getProfiles: async (): Promise<Profile[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('profiles').select('*');
      if (data) return data as Profile[];
    }
    return simulator.profiles;
  },

  getGames: async (): Promise<Game[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('games').select('*');
      if (data) return data as Game[];
    }
    return simulator.games;
  },

  // Tournaments
  getTournaments: async (): Promise<Tournament[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) return data as Tournament[];
    }
    return simulator.tournaments;
  },

  getTournament: async (id: string): Promise<Tournament | undefined> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .single();
      if (data) return data as Tournament;
    }
    return simulator.tournaments.find(t => t.id === id);
  },

  createTournament: async (tournament: Omit<Tournament, 'id' | 'created_at' | 'updated_at'>): Promise<Tournament> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tournaments')
        .insert([tournament])
        .select()
        .single();
      if (!error && data) return data as Tournament;
    }

    const newTournament: Tournament = {
      ...tournament,
      id: Math.random().toString(36).substring(7),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const list = simulator.tournaments;
    list.unshift(newTournament);
    simulator.tournaments = list;

    simulator.addLog(tournament.organizer_id, 'TOURNAMENT_CREATE', `Created tournament "${tournament.title}"`);
    return newTournament;
  },

  updateTournamentStatus: async (id: string, status: TournamentStatus, winnerId?: string): Promise<Tournament> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tournaments')
        .update({ status, winner_id: winnerId, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data as Tournament;
    }

    const list = simulator.tournaments;
    const idx = list.findIndex(t => t.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], status, winner_id: winnerId, updated_at: new Date().toISOString() };
      simulator.tournaments = list;

      // Log activity
      const t = list[idx];
      simulator.addLog(t.organizer_id, 'TOURNAMENT_UPDATE', `Tournament "${t.title}" status changed to ${status}`);

      // If completed, trigger achievement for winner and trigger notifications
      if (status === 'completed' && winnerId) {
        simulator.earnAchievement(winnerId, 'ac3'); // Champion Ascent
        
        // Notify players
        const regs = simulator.tournamentPlayers.filter(p => p.tournament_id === id && p.status === 'approved');
        regs.forEach(reg => {
          simulator.addNotification(
            reg.player_id, 
            'Tournament Crowned!', 
            `"${t.title}" has concluded. Congratulations to the Champion!`, 
            `/tournaments/${id}`
          );
        });

        // Update winner statistics
        const stats = simulator.statistics;
        const winnerStatsIdx = stats.findIndex(s => s.user_id === winnerId && s.game_id === t.game_id);
        if (winnerStatsIdx >= 0) {
          stats[winnerStatsIdx].tournaments_won += 1;
          stats[winnerStatsIdx].tournaments_played += 1;
          stats[winnerStatsIdx].updated_at = new Date().toISOString();
          simulator.statistics = stats;
        } else {
          stats.push({
            id: Math.random().toString(36).substring(7),
            user_id: winnerId,
            game_id: t.game_id,
            matches_played: 3,
            matches_won: 3,
            matches_lost: 0,
            tournaments_played: 1,
            tournaments_won: 1,
            win_rate: 100.0,
            updated_at: new Date().toISOString()
          });
          simulator.statistics = stats;
        }

        // Leaderboard point bump for winner
        const lb = simulator.leaderboards;
        const winnerLbIdx = lb.findIndex(l => l.user_id === winnerId && l.game_id === t.game_id);
        if (winnerLbIdx >= 0) {
          lb[winnerLbIdx].rank_points += 300;
          lb[winnerLbIdx].updated_at = new Date().toISOString();
        } else {
          const profile = simulator.profiles.find(p => p.id === winnerId);
          lb.push({
            id: Math.random().toString(36).substring(7),
            user_id: winnerId,
            game_id: t.game_id,
            rank_points: 1300,
            username: profile?.username || 'Unknown Winner',
            avatar_url: profile?.avatar_url,
            updated_at: new Date().toISOString()
          });
        }
        simulator.leaderboards = lb;
      }

      return list[idx];
    }
    throw new Error('Tournament not found');
  },

  // Registrations (Tournament Players)
  getTournamentPlayers: async (tournamentId: string): Promise<TournamentPlayer[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('tournament_players')
        .select('*')
        .eq('tournament_id', tournamentId);
      if (data) return data as TournamentPlayer[];
    }
    return simulator.tournamentPlayers.filter(p => p.tournament_id === tournamentId);
  },

  registerPlayer: async (tournamentId: string, playerId: string): Promise<TournamentPlayer> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tournament_players')
        .insert([{ tournament_id: tournamentId, player_id: playerId, status: 'pending' }])
        .select()
        .single();
      if (!error && data) return data as TournamentPlayer;
    }

    const existing = simulator.tournamentPlayers.find(tp => tp.tournament_id === tournamentId && tp.player_id === playerId);
    if (existing) return existing;

    const newReg: TournamentPlayer = {
      id: Math.random().toString(36).substring(7),
      tournament_id: tournamentId,
      player_id: playerId,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const list = simulator.tournamentPlayers;
    list.push(newReg);
    simulator.tournamentPlayers = list;

    // Log Activity
    simulator.addLog(playerId, 'TOURNAMENT_REGISTER', 'Registered for tournament');
    
    // Check Achievement: Tournament Spree (5 registrations)
    const userRegsCount = simulator.tournamentPlayers.filter(tp => tp.player_id === playerId).length;
    if (userRegsCount >= 5) {
      simulator.earnAchievement(playerId, 'ac4'); // Tournament Spree
    }

    return newReg;
  },

  approvePlayer: async (registrationId: string, status: PlayerRegistrationStatus): Promise<TournamentPlayer> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tournament_players')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', registrationId)
        .select()
        .single();
      if (!error && data) return data as TournamentPlayer;
    }

    const list = simulator.tournamentPlayers;
    const idx = list.findIndex(r => r.id === registrationId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], status };
      simulator.tournamentPlayers = list;

      const reg = list[idx];
      const tournament = simulator.tournaments.find(t => t.id === reg.tournament_id);
      
      // Notify player
      simulator.addNotification(
        reg.player_id,
        status === 'approved' ? 'Registration Approved!' : 'Registration Update',
        `Your slot in "${tournament?.title || 'tournament'}" has been ${status}.`,
        `/tournaments/${reg.tournament_id}`
      );

      return reg;
    }
    throw new Error('Registration not found');
  },

  // Matches & Bracket Generation
  getMatches: async (tournamentId: string): Promise<Match[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round_no', { ascending: true })
        .order('match_no', { ascending: true });
      if (data) return data as Match[];
    }
    return simulator.matches.filter(m => m.tournament_id === tournamentId);
  },

  generateBracket: async (tournamentId: string): Promise<Match[]> => {
    if (isSupabaseConfigured && supabase) {
      // In production, this can call a Postgres function or perform sequential inserts.
      // We will perform client-side generation for simplicity and seamlessness.
    }

    // Get approved players
    const approvedRegs = simulator.tournamentPlayers
      .filter(tp => tp.tournament_id === tournamentId && tp.status === 'approved')
      .slice(0, 8); // Support size 8 for seamless demo brackets

    if (approvedRegs.length < 2) {
      throw new Error('At least 2 approved players are required to generate a bracket.');
    }

    // Single Elimination Bracket Generation (assuming 8 players)
    // Round 1 has 4 matches
    // Round 2 (semis) has 2 matches
    // Round 3 (finals) has 1 match
    const numPlayers = approvedRegs.length;
    let size = 8; // standard demo size
    if (numPlayers <= 2) size = 2;
    else if (numPlayers <= 4) size = 4;

    const matchesToInsert: Match[] = [];
    const now = new Date().toISOString();

    // Create unique IDs beforehand
    const fId = 'mf-' + Math.random().toString(36).substring(7); // Final Match ID
    const sf1Id = 'msf1-' + Math.random().toString(36).substring(7); // Semifinal 1 ID
    const sf2Id = 'msf2-' + Math.random().toString(36).substring(7); // Semifinal 2 ID

    if (size === 8) {
      // Round 3 (Finals)
      const finalMatch: Match = {
        id: fId, tournament_id: tournamentId, round_no: 3, match_no: 1,
        player1_score: 0, player2_score: 0, status: 'waiting', created_at: now, updated_at: now
      };
      // Round 2 (Semifinals)
      const sf1: Match = {
        id: sf1Id, tournament_id: tournamentId, round_no: 2, match_no: 1,
        player1_score: 0, player2_score: 0, status: 'waiting', next_match_id: fId, created_at: now, updated_at: now
      };
      const sf2: Match = {
        id: sf2Id, tournament_id: tournamentId, round_no: 2, match_no: 2,
        player1_score: 0, player2_score: 0, status: 'waiting', next_match_id: fId, created_at: now, updated_at: now
      };

      // Round 1 (Quarterfinals)
      const r1m1: Match = {
        id: 'mr1m1-' + Math.random().toString(36).substring(7), tournament_id: tournamentId, round_no: 1, match_no: 1,
        player1_id: approvedRegs[0]?.player_id, player2_id: approvedRegs[7]?.player_id || undefined,
        player1_score: 0, player2_score: 0, status: approvedRegs[7] ? 'playing' : 'completed',
        winner_id: approvedRegs[7] ? undefined : approvedRegs[0]?.player_id,
        next_match_id: sf1Id, created_at: now, updated_at: now
      };
      const r1m2: Match = {
        id: 'mr1m2-' + Math.random().toString(36).substring(7), tournament_id: tournamentId, round_no: 1, match_no: 2,
        player1_id: approvedRegs[3]?.player_id || undefined, player2_id: approvedRegs[4]?.player_id || undefined,
        player1_score: 0, player2_score: 0, status: (approvedRegs[3] && approvedRegs[4]) ? 'playing' : 'completed',
        winner_id: (approvedRegs[3] && !approvedRegs[4]) ? approvedRegs[3].player_id : (approvedRegs[4] && !approvedRegs[3]) ? approvedRegs[4].player_id : undefined,
        next_match_id: sf1Id, created_at: now, updated_at: now
      };
      const r1m3: Match = {
        id: 'mr1m3-' + Math.random().toString(36).substring(7), tournament_id: tournamentId, round_no: 1, match_no: 3,
        player1_id: approvedRegs[1]?.player_id || undefined, player2_id: approvedRegs[6]?.player_id || undefined,
        player1_score: 0, player2_score: 0, status: (approvedRegs[1] && approvedRegs[6]) ? 'playing' : 'completed',
        winner_id: (approvedRegs[1] && !approvedRegs[6]) ? approvedRegs[1].player_id : (approvedRegs[6] && !approvedRegs[1]) ? approvedRegs[6].player_id : undefined,
        next_match_id: sf2Id, created_at: now, updated_at: now
      };
      const r1m4: Match = {
        id: 'mr1m4-' + Math.random().toString(36).substring(7), tournament_id: tournamentId, round_no: 1, match_no: 4,
        player1_id: approvedRegs[2]?.player_id || undefined, player2_id: approvedRegs[5]?.player_id || undefined,
        player1_score: 0, player2_score: 0, status: (approvedRegs[2] && approvedRegs[5]) ? 'playing' : 'completed',
        winner_id: (approvedRegs[2] && !approvedRegs[5]) ? approvedRegs[2].player_id : (approvedRegs[5] && !approvedRegs[2]) ? approvedRegs[5].player_id : undefined,
        next_match_id: sf2Id, created_at: now, updated_at: now
      };

      // Set up Semifinal starters if bye-runs exist
      if (r1m1.winner_id) sf1.player1_id = r1m1.winner_id;
      if (r1m2.winner_id) sf1.player2_id = r1m2.winner_id;
      if (r1m3.winner_id) sf2.player1_id = r1m3.winner_id;
      if (r1m4.winner_id) sf2.player2_id = r1m4.winner_id;

      if (sf1.player1_id && sf1.player2_id) sf1.status = 'playing';
      if (sf2.player1_id && sf2.player2_id) sf2.status = 'playing';

      matchesToInsert.push(r1m1, r1m2, r1m3, r1m4, sf1, sf2, finalMatch);
    } else {
      // 4 Player Bracket (Size 4)
      const finalMatch: Match = {
        id: fId, tournament_id: tournamentId, round_no: 2, match_no: 1,
        player1_score: 0, player2_score: 0, status: 'waiting', created_at: now, updated_at: now
      };
      const r1m1: Match = {
        id: sf1Id, tournament_id: tournamentId, round_no: 1, match_no: 1,
        player1_id: approvedRegs[0]?.player_id, player2_id: approvedRegs[3]?.player_id || undefined,
        player1_score: 0, player2_score: 0, status: approvedRegs[3] ? 'playing' : 'completed',
        winner_id: approvedRegs[3] ? undefined : approvedRegs[0]?.player_id,
        next_match_id: fId, created_at: now, updated_at: now
      };
      const r1m2: Match = {
        id: sf2Id, tournament_id: tournamentId, round_no: 1, match_no: 2,
        player1_id: approvedRegs[1]?.player_id || undefined, player2_id: approvedRegs[2]?.player_id || undefined,
        player1_score: 0, player2_score: 0, status: (approvedRegs[1] && approvedRegs[2]) ? 'playing' : 'completed',
        winner_id: (approvedRegs[1] && !approvedRegs[2]) ? approvedRegs[1].player_id : (approvedRegs[2] && !approvedRegs[1]) ? approvedRegs[2].player_id : undefined,
        next_match_id: fId, created_at: now, updated_at: now
      };

      if (r1m1.winner_id) finalMatch.player1_id = r1m1.winner_id;
      if (r1m2.winner_id) finalMatch.player2_id = r1m2.winner_id;
      if (finalMatch.player1_id && finalMatch.player2_id) finalMatch.status = 'playing';

      matchesToInsert.push(r1m1, r1m2, finalMatch);
    }

    // Save matches
    const allMatches = simulator.matches.filter(m => m.tournament_id !== tournamentId);
    const updatedMatches = [...allMatches, ...matchesToInsert];
    simulator.matches = updatedMatches;

    // Update Tournament Status to Active
    const tournaments = simulator.tournaments;
    const tIdx = tournaments.findIndex(t => t.id === tournamentId);
    if (tIdx >= 0) {
      tournaments[tIdx].status = 'active';
      simulator.tournaments = tournaments;
    }

    // Notify registered approved players
    approvedRegs.forEach(reg => {
      simulator.addNotification(
        reg.player_id, 
        'Bracket Generated!', 
        'The tournament bracket has been created! Check your assigned matches.', 
        `/tournaments/${tournamentId}`
      );
    });

    return matchesToInsert;
  },

  // Match Result Submission & Verification
  submitMatchResult: async (matchId: string, player1_score: number, player2_score: number, proofUrl: string, submittedBy: string): Promise<MatchResult> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('match_results')
        .insert([{ match_id: matchId, player1_score, player2_score, proof_url: proofUrl, submitted_by: submittedBy, status: 'pending' }])
        .select()
        .single();
      if (!error && data) return data as MatchResult;
    }

    const newResult: MatchResult = {
      id: Math.random().toString(36).substring(7),
      match_id: matchId,
      player1_score,
      player2_score,
      proof_url: proofUrl,
      submitted_by: submittedBy,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const list = simulator.matchResults;
    const existingIdx = list.findIndex(r => r.match_id === matchId && r.submitted_by === submittedBy);
    if (existingIdx >= 0) {
      list[existingIdx] = newResult;
    } else {
      list.push(newResult);
    }
    simulator.matchResults = list;

    // Update match status to disputed or stay pending verification
    const matches = simulator.matches;
    const mIdx = matches.findIndex(m => m.id === matchId);
    if (mIdx >= 0) {
      matches[mIdx].status = 'disputed'; // Flag for organizer approval
      simulator.matches = matches;

      // Notify organizers
      const tournament = simulator.tournaments.find(t => t.id === matches[mIdx].tournament_id);
      if (tournament) {
        simulator.addNotification(
          tournament.organizer_id,
          'Match Result Submitted',
          `A match score report has been submitted for match #${matches[mIdx].match_no} in "${tournament.title}". Verification required.`,
          `/tournaments/${tournament.id}`
        );
      }
    }

    simulator.earnAchievement(submittedBy, 'ac5'); // Veracious Reporter
    simulator.addLog(submittedBy, 'SCORE_SUBMIT', `Submitted score reporting (${player1_score}-${player2_score})`);

    return newResult;
  },

  verifyMatchResult: async (matchId: string, winnerId: string, p1Score: number, p2Score: number): Promise<Match> => {
    if (isSupabaseConfigured && supabase) {
      // Production database updates...
    }

    const matches = simulator.matches;
    const mIdx = matches.findIndex(m => m.id === matchId);
    if (mIdx >= 0) {
      const match = matches[mIdx];
      match.player1_score = p1Score;
      match.player2_score = p2Score;
      match.winner_id = winnerId;
      match.status = 'completed';
      match.updated_at = new Date().toISOString();

      // Log Winner Activity
      simulator.addLog(winnerId, 'MATCH_WIN', `Won match against opponent`);
      simulator.earnAchievement(winnerId, 'ac1'); // First Victory

      // Update players statistics
      const p1 = match.player1_id;
      const p2 = match.player2_id;
      const tournament = simulator.tournaments.find(t => t.id === match.tournament_id);
      
      if (tournament) {
        const stats = simulator.statistics;
        const gameId = tournament.game_id;

        const updateStats = (userId: string, won: boolean) => {
          const sIdx = stats.findIndex(s => s.user_id === userId && s.game_id === gameId);
          if (sIdx >= 0) {
            stats[sIdx].matches_played += 1;
            if (won) stats[sIdx].matches_won += 1;
            else stats[sIdx].matches_lost += 1;
            stats[sIdx].updated_at = new Date().toISOString();
          } else {
            stats.push({
              id: Math.random().toString(36).substring(7),
              user_id: userId,
              game_id: gameId,
              matches_played: 1,
              matches_won: won ? 1 : 0,
              matches_lost: won ? 0 : 1,
              tournaments_played: 1,
              tournaments_won: 0,
              win_rate: won ? 100.0 : 0.0,
              updated_at: new Date().toISOString()
            });
          }
        };

        if (p1) updateStats(p1, winnerId === p1);
        if (p2) updateStats(p2, winnerId === p2);
        simulator.statistics = stats;
      }

      // If next match is assigned, advance the winner!
      if (match.next_match_id) {
        const nextIdx = matches.findIndex(m => m.id === match.next_match_id);
        if (nextIdx >= 0) {
          const nextMatch = matches[nextIdx];
          
          // Assign player to vacant slot
          if (!nextMatch.player1_id) {
            nextMatch.player1_id = winnerId;
          } else if (!nextMatch.player2_id) {
            nextMatch.player2_id = winnerId;
          }

          // If both slots now filled, set status to playing!
          if (nextMatch.player1_id && nextMatch.player2_id) {
            nextMatch.status = 'playing';
          }
          nextMatch.updated_at = new Date().toISOString();
          matches[nextIdx] = nextMatch;
        }
      } else {
        // No next match = Grand Finals match! Crown the champion!
        if (tournament) {
          await db.updateTournamentStatus(tournament.id, 'completed', winnerId);
        }
      }

      matches[mIdx] = match;
      simulator.matches = matches;

      // Update match result approvals
      const mResults = simulator.matchResults;
      const rIdx = mResults.findIndex(r => r.match_id === matchId);
      if (rIdx >= 0) {
        mResults[rIdx].status = 'approved';
        simulator.matchResults = mResults;
      }

      return match;
    }
    throw new Error('Match not found');
  },

  // Leaderboard & Stats
  getLeaderboard: async (gameId: string): Promise<Leaderboard[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('leaderboards')
        .select('*, profiles(username, avatar_url)')
        .eq('game_id', gameId)
        .order('rank_points', { ascending: false });
      if (data) {
        return data.map((item: any) => ({
          ...item,
          username: item.profiles?.username,
          avatar_url: item.profiles?.avatar_url
        })) as Leaderboard[];
      }
    }
    return simulator.leaderboards
      .filter(l => l.game_id === gameId)
      .sort((a, b) => b.rank_points - a.rank_points);
  },

  getPlayerStats: async (userId: string): Promise<PlayerStatistics[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('player_statistics')
        .select('*')
        .eq('user_id', userId);
      if (data) return data as PlayerStatistics[];
    }
    return simulator.statistics.filter(s => s.user_id === userId);
  },

  // Notifications
  getNotifications: async (userId: string): Promise<Notification[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (data) return data as Notification[];
    }
    return simulator.notifications.filter(n => n.user_id === userId);
  },

  markNotificationAsRead: async (id: string): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
    }
    const list = simulator.notifications;
    const idx = list.findIndex(n => n.id === id);
    if (idx >= 0) {
      list[idx].is_read = true;
      simulator.notifications = list;
    }
  },

  // Achievements
  getAchievements: async (): Promise<Achievement[]> => {
    return simulator.achievements;
  },

  getUserAchievements: async (userId: string): Promise<UserAchievement[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId);
      if (data) return data as UserAchievement[];
    }
    // Filter simulator list
    const earned = simulator.userAchievements.filter(ua => ua.user_id === userId);
    return earned.map(e => ({
      id: Math.random().toString(36).substring(7),
      user_id: e.user_id,
      achievement_id: e.achievement_id,
      earned_at: e.earned_at
    }));
  },

  // Settings
  getSettings: async (userId: string): Promise<Settings> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (data) return data as Settings;
    }
    return simulator.settings;
  },

  updateSettings: async (userId: string, updates: Partial<Settings>): Promise<Settings> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('settings')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();
      if (data) return data as Settings;
    }
    const current = simulator.settings;
    const updated = { ...current, ...updates };
    simulator.settings = updated;
    return updated;
  },

  // Activity Logs
  getActivityLogs: async (userId: string): Promise<ActivityLog[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (data) return data as ActivityLog[];
    }
    return simulator.logs.filter(l => l.user_id === userId);
  },

  // Chat Feature
  getChatMessages: async (tournamentId: string): Promise<ChatMessage[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('chats')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true });
      if (data) return data as ChatMessage[];
    }
    return simulator.chatMessages.filter(msg => msg.tournament_id === tournamentId);
  },

  sendChatMessage: async (tournamentId: string, userId: string, username: string, avatarUrl: string, content: string): Promise<ChatMessage> => {
    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      tournament_id: tournamentId,
      user_id: userId,
      username,
      avatar_url: avatarUrl,
      content,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('chats')
        .insert([newMessage])
        .select()
        .single();
      if (data) return data as ChatMessage;
    }

    // simulator fallback
    const list = simulator.chatMessages;
    list.push(newMessage);
    simulator.chatMessages = list;
    return newMessage;
  }
};
