export type UserRole = 'admin' | 'organizer' | 'player';

export interface Profile {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  role: UserRole;
  bio?: string;
  created_at: string;
  updated_at: string;
}

export interface Game {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  cover_image?: string;
  created_at: string;
}

export type TournamentStatus = 'draft' | 'registration' | 'active' | 'completed';
export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin';

export interface Tournament {
  id: string;
  title: string;
  description: string;
  game_id: string;
  organizer_id: string;
  banner_url?: string;
  max_players: number;
  status: TournamentStatus;
  start_time: string;
  format: TournamentFormat;
  prize_pool: string;
  rules?: string;
  winner_id?: string;
  created_at: string;
  updated_at: string;
}

export type PlayerRegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface TournamentPlayer {
  id: string;
  tournament_id: string;
  player_id: string;
  status: PlayerRegistrationStatus;
  seed_no?: number;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  logo_url?: string;
  captain_id?: string;
  created_at: string;
}

export type MatchStatus = 'scheduled' | 'waiting' | 'playing' | 'disputed' | 'completed';

export interface Match {
  id: string;
  tournament_id: string;
  round_no: number;
  match_no: number;
  player1_id?: string;
  player2_id?: string;
  player1_score: number;
  player2_score: number;
  winner_id?: string;
  status: MatchStatus;
  next_match_id?: string;
  scheduled_time?: string;
  created_at: string;
  updated_at: string;
}

export type MatchResultStatus = 'pending' | 'approved' | 'disputed';

export interface MatchResult {
  id: string;
  match_id: string;
  submitted_by: string;
  player1_score: number;
  player2_score: number;
  proof_url?: string;
  status: MatchResultStatus;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  content: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  badge_icon: string;
  xp_reward: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
}

export interface Leaderboard {
  id: string;
  user_id: string;
  game_id: string;
  rank_points: number;
  username?: string; // Joined from profile
  avatar_url?: string; // Joined from profile
  updated_at: string;
}

export interface PlayerStatistics {
  id: string;
  user_id: string;
  game_id: string;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  tournaments_played: number;
  tournaments_won: number;
  win_rate: number;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  description: string;
  created_at: string;
}

export interface Settings {
  id: string;
  user_id: string;
  push_notifications: boolean;
  email_notifications: boolean;
  public_profile: boolean;
  dark_mode: boolean;
}

export interface ChatMessage {
  id: string;
  tournament_id: string; // Can be 'global' for lobby or UUID of a tournament
  user_id: string;
  username: string;
  avatar_url?: string;
  content: string;
  created_at: string;
}

