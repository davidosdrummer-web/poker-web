export type Lang = 'ru' | 'en';
export type Role = 'admin' | 'operator' | 'player';
export type ScreenMode = 'live' | 'tables' | 'board' | 'results' | 'table';
export type PlayerStatus = 'active' | 'blocked' | 'archived';
export type GameType = 'holdem' | 'omaha' | 'mixed';
export type TournamentStatus = 'scheduled' | 'registration' | 'running' | 'paused' | 'break' | 'finished';
export type TickerKind = 'info' | 'level' | 'break' | 'alert' | 'custom';

export interface BlindLevel {
  id: string;
  sb: number;
  bb: number;
  ante: number;
  duration: number;
  isBreak: boolean;
}

export interface TableT {
  id: string;
  name: string;
  seats: number;
}

export interface PointsRow {
  place: number;
  points: number;
}

export interface Season {
  id: string;
  name: string;
  createdAt: number;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  joinedAt: number;
  status: PlayerStatus;
  avatarColor: string | null;
  avatarData?: string | null;
  basePoints: number;
  userId?: string | null;
  notes?: string;
  knockouts: number;
  rebuyCount: number;
}

export interface TournamentTemplate {
  id: string;
  name: string;
  createdAt: number;
  gameType: GameType;
  startingStack: number;
  levels: BlindLevel[];
  pointsGrid: PointsRow[];
  participationPoints: number;
  rebuyPenalty: number;
  addonPenalty: number;
  rebuyChips: number;
  reentryChips: number;
  addonChips: number;
  bonuses: TournamentBonus[];
  knockoutPointsEnabled: boolean;
  knockoutPoints: number;
  regWindowSec: number | null;
  rebuyWindowSec: number | null;
}

export interface BonusGrant {
  time: number;
  chips: number;
  reason: string;
}

export interface StackSnapshot {
  time: number;
  levelIndex: number;
  stack: number;
  event: 'start' | 'level' | 'eliminate' | 'rebuy' | 'addon' | 'reentry' | 'finish';
  note?: string;
}

export interface TournamentEntry {
  playerId: string;
  registeredAt: number;
  entries: number;
  rebuys: number;
  addons: number;
  stack: number;
  tableId: string | null;
  seat: number | null;
  lastTableId: string | null;
  lastSeat: number | null;
  eliminated: boolean;
  place: number | null;
  points: number | null;
  eliminatedBy: string | null;
  outLevel: number | null;
  bonusLog: BonusGrant[];
  livePoints: number;
  knockouts: number;
  stackHistory: StackSnapshot[];
}

export interface ResultRow {
  playerId: string;
  place: number;
  points: number;
}

export interface Tournament {
  id: string;
  name: string;
  date: number;
  gameType: GameType;
  description: string;
  seasonId: string | null;
  status: TournamentStatus;
  startingStack: number;
  registrationClosesAt: number | null;
  rebuyClosesAt: number | null;
  rebuyChips: number;
  bonuses: TournamentBonus[];
  knockoutPointsEnabled: boolean;
  knockoutPoints: number;
  reentryChips: number;
  addonChips: number;
  levels: BlindLevel[];
  levelIndex: number;
  levelEndsAt: number | null;
  pausedRemaining: number | null;
  pausedFromBreak: boolean;
  breakReturnRemaining: number | null;
  tables: TableT[];
  entries: TournamentEntry[];
  pointsGrid: PointsRow[];
  participationPoints: number;
  rebuyPenalty: number;
  addonPenalty: number;
  results: ResultRow[] | null;
  createdAt: number;
}

export interface TickerItem {
  id: string;
  time: number;
  text: string;
  kind: TickerKind;
}

export interface ScreenConfig {
  showTimer: boolean;
  showBlinds: boolean;
  showStats: boolean;
  showTicker: boolean;
  boardSeasonId: string | null;
}

export interface TournamentBonus {
  id: string;
  name: string;
  chips: number;
}

export interface Settings {
  clubName: string;
  clubShort: string;
  accent: string;
  logo?: string | null;
  language: Lang;
  sound: 'off' | 'bell' | 'voice';
  sfx: boolean;
  sfxEvents: Record<'start' | 'eliminate' | 'level' | 'break' | 'rebuy' | 'reentry' | 'addon' | 'end', boolean>;
  role: Role;
  screens: ScreenConfig;
  tournamentTemplates: TournamentTemplate[];
  pointsTemplate: PointsRow[];
  participationTemplate: number;
  rebuyPenaltyTemplate: number;
  addonPenaltyTemplate: number;
}

export interface AppState {
  rev: number;
  savedAt: number;
  settings: Settings;
  players: Player[];
  seasons: Season[];
  tournaments: Tournament[];
  activeTournamentId: string | null;
  ticker: TickerItem[];
}