// src/lib/store.ts
import { useSyncExternalStore } from 'react';
import type {
  AppState,
  BlindLevel,
  Player,
  PlayerStatus,
  PointsRow,
  Role,
  ScreenConfig,
  Season,
  Settings,
  TableT,
  TickerItem,
  Tournament,
  TournamentStatus,
  TournamentTemplate,
} from './types';
import { blindLevels, defaultBonuses, seedState } from './data';
import { autoSeatPlan, balanceSuggestions, entryPoints, fmtChips, fmtInt, fullName, leaderboardRows, liveStats, uid, type AutoSeatMode, type Suggestion } from './utils';
// Импортируем Firebase
import { db, getUserId, ref, set, get, onValue, off } from './firebase';
// Импортируем currentRole для получения роли из аутентификации
import { currentRole } from './auth';

// ---------- Константы и нормализация ----------
const DEFAULTS = seedState();

function normalize(raw: AppState): AppState {
  const base: AppState = {
    ...DEFAULTS,
    ...raw,
    settings: { ...DEFAULTS.settings, ...raw.settings, screens: { ...DEFAULTS.settings.screens, ...(raw.settings?.screens ?? {}) }, sfxEvents: { ...DEFAULTS.settings.sfxEvents, ...(raw.settings?.sfxEvents ?? {}) }, tournamentTemplates: raw.settings?.tournamentTemplates ?? [] },
  };
  base.players = base.players.map((p) => Object.assign({ basePoints: 0 }, p));
  base.tournaments = base.tournaments.map((t) => {
    const merged = Object.assign(
      { registrationClosesAt: null as number | null, rebuyClosesAt: null as number | null, knockoutPointsEnabled: true, knockoutPoints: 3 },
      t,
    );
    const legacy = t as unknown as Record<string, unknown>;
    if (typeof legacy.rebuyChips !== 'number') merged.rebuyChips = t.startingStack;
    if (typeof legacy.reentryChips !== 'number') merged.reentryChips = t.startingStack;
    if (typeof legacy.addonChips !== 'number') merged.addonChips = Math.round(t.startingStack / 2);
    if (!Array.isArray(legacy.bonuses)) merged.bonuses = defaultBonuses();
    merged.entries = t.entries.map((e) =>
      Object.assign(
        { entries: 1, lastTableId: null as string | null, lastSeat: null as number | null, bonusLog: [] as Tournament['entries'][number]['bonusLog'], livePoints: 0, knockouts: 0 },
        e,
      ),
    );
    return merged;
  });
  return base;
}

// ---------- Состояние и подписки ----------
let state: AppState = seedState(); // временная заглушка
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---------- Загрузка из Firebase ----------
async function loadFromFirebase(): Promise<AppState> {
  const userId = getUserId();
  if (!userId) return seedState();

  try {
    const stateRef = ref(db, `users/${userId}/state`);
    const snapshot = await get(stateRef);
    if (snapshot.exists()) {
      const raw = snapshot.val();
      if (raw && raw.settings && Array.isArray(raw.players) && Array.isArray(raw.tournaments)) {
        return normalize(raw);
      }
    }
  } catch (e) {
    console.warn('Failed to load from Firebase, using seed', e);
  }
  return seedState();
}

// ---------- Сохранение в Firebase (с дебаунсом) ----------
let persistTimeout: ReturnType<typeof setTimeout> | null = null;

async function saveToFirebase() {
  const userId = getUserId();
  if (!userId) return;

  try {
    const stateRef = ref(db, `users/${userId}/state`);
    // Сохраняем копию, удаляя возможные циклические ссылки (их нет)
    await set(stateRef, {
      ...state,
      savedAt: Date.now()
    });
  } catch (e) {
    console.warn('Failed to save to Firebase', e);
  }
}

function persist(broadcast: boolean) {
  // Дебаунс – группируем изменения
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => {
    saveToFirebase();
    persistTimeout = null;
  }, 300);
  // broadcast игнорируем – Firebase сам синхронизирует
}

// ---------- Подписка на изменения из Firebase (синхронизация между устройствами) ----------
let firebaseUnsubscribe: (() => void) | null = null;

function initFirebaseSync() {
  const userId = getUserId();
  if (!userId) {
    // Если пользователь вышел, отписываемся
    if (firebaseUnsubscribe) {
      firebaseUnsubscribe();
      firebaseUnsubscribe = null;
    }
    return;
  }

  const stateRef = ref(db, `users/${userId}/state`);

  // Отписываемся от старой подписки
  if (firebaseUnsubscribe) {
    firebaseUnsubscribe();
    firebaseUnsubscribe = null;
  }

  firebaseUnsubscribe = onValue(stateRef, (snapshot) => {
    if (!snapshot.exists()) return;
    const remote = snapshot.val();
    if (remote && remote.rev > state.rev) {
      state = normalize(remote);
      // Принудительно устанавливаем роль из auth
      const userRole = currentRole();
      if (userRole && state.settings.role !== userRole) {
        state.settings.role = userRole;
        // Увеличиваем rev, чтобы сохранить изменения
        state.rev += 1;
        // Сохраняем обновленное состояние
        persist(true);
      }
      emit(); // Оповещаем React
    }
  });
}

// ---------- Инициализация хранилища ----------
export async function initStore() {
  const loaded = await loadFromFirebase();
  // Принудительно устанавливаем роль из auth, чтобы перезаписать сохранённую роль
  const userRole = currentRole();
  if (userRole) {
    loaded.settings.role = userRole;
  }
  state = loaded;
  emit();
  initFirebaseSync();
  // Если роль была применена, сохраняем состояние с новой ролью
  if (userRole && state.settings.role === userRole) {
    // Увеличиваем rev, чтобы состояние сохранилось
    state.rev += 1;
    persist(true);
  }
}

// ---------- Геттеры и хук ----------
export function getState(): AppState {
  return state;
}

export function useApp(): AppState {
  return useSyncExternalStore(subscribe, getState);
}

export function getActiveTournament(s: AppState): Tournament | null {
  return s.tournaments.find((t) => t.id === s.activeTournamentId) ?? null;
}

// ---------- Права доступа ----------
type Perm = 'players' | 'structure' | 'live' | 'club';
const ROLE_PERMS: Record<Role, Perm[]> = {
  admin: ['players', 'structure', 'live', 'club'],
  operator: ['live'],
};

export function can(perm: Perm): boolean {
  const role = currentRole() ?? state.settings.role;
  return ROLE_PERMS[role].includes(perm);
}

// ---------- Ядро: коммит изменений ----------
function commit(mutator: (draft: AppState) => void): boolean {
  const draft = JSON.parse(JSON.stringify(state)) as AppState;
  mutator(draft);
  draft.rev = state.rev + 1;
  draft.savedAt = Date.now();
  state = draft;
  persist(true);
  emit();
  return true;
}

// ---------- Вспомогательные функции (перенесены из оригинала) ----------
function pushTicker(d: AppState, text: string, kind: TickerItem['kind']) {
  d.ticker = [{ id: uid(), time: Date.now(), text, kind }, ...d.ticker].slice(0, 10);
}

function findT(d: AppState, id: string): Tournament | undefined {
  return d.tournaments.find((t) => t.id === id);
}

function levelNumber(d: AppState, t: Tournament, idx: number): number {
  return t.levels.slice(0, idx + 1).filter((l) => !l.isBreak).length;
}

function nowRemaining(t: Tournament): number | null {
  if (t.status === 'paused') return t.pausedRemaining;
  if (t.levelEndsAt) return Math.max(0, Math.round((t.levelEndsAt - Date.now()) / 1000));
  return null;
}

const LIVE_STATUSES: TournamentStatus[] = ['running', 'paused', 'break'];

export function regClosed(t: Tournament): boolean {
  return t.registrationClosesAt != null && Date.now() > t.registrationClosesAt;
}

export function rebuyClosed(t: Tournament): boolean {
  return t.rebuyClosesAt != null && Date.now() > t.rebuyClosesAt;
}

function rebuyClosedById(tId: string): boolean {
  const t = state.tournaments.find((x) => x.id === tId);
  return !t || rebuyClosed(t);
}

function freshEntry(t: Tournament, playerId: string): Tournament['entries'][number] {
  return {
    playerId,
    registeredAt: Date.now(),
    entries: 1,
    rebuys: 0,
    addons: 0,
    stack: t.startingStack,
    tableId: null,
    seat: null,
    lastTableId: null,
    lastSeat: null,
    eliminated: false,
    place: null,
    points: null,
    eliminatedBy: null,
    outLevel: null,
    bonusLog: [],
    livePoints: 0,
    knockouts: 0,
  };
}

function revive(d: AppState, t: Tournament, e: Tournament['entries'][number], stack: number) {
  e.eliminated = false;
  e.place = null;
  e.points = null;
  e.stack = stack;
  if (e.lastTableId && e.lastSeat) {
    const table = t.tables.find((x) => x.id === e.lastTableId);
    const busy = t.entries.some((x) => x.playerId !== e.playerId && x.tableId === e.lastTableId && x.seat === e.lastSeat && !x.eliminated);
    if (table && e.lastSeat <= table.seats && !busy) {
      e.tableId = e.lastTableId;
      e.seat = e.lastSeat;
    } else {
      const free = firstFreeSeat(t, null);
      e.tableId = free?.tableId ?? null;
      e.seat = free?.seat ?? null;
    }
  } else {
    const free = firstFreeSeat(t, null);
    e.tableId = free?.tableId ?? null;
    e.seat = free?.seat ?? null;
  }
  e.lastTableId = null;
  e.lastSeat = null;
}

function applyLevelStart(t: Tournament, idx: number) {
  const lvl = t.levels[idx];
  if (!lvl) return;
  t.levelIndex = idx;
  t.levelEndsAt = Date.now() + lvl.duration * 60_000;
  t.pausedRemaining = null;
  t.status = lvl.isBreak ? 'break' : 'running';
}

function finalizeInner(d: AppState, t: Tournament, order: string[], auto: boolean) {
  const stats = liveStats(t);
  order.forEach((pid, i) => {
    const e = t.entries.find((x) => x.playerId === pid);
    if (!e) return;
    e.place = i + 1;
    e.eliminated = true;
    e.tableId = null;
    e.seat = null;
    e.points = entryPoints(t, i + 1, e.rebuys, e.addons);
  });
  t.entries.forEach((e) => {
    if (e.points == null) {
      e.place = e.place ?? t.entries.length;
      e.points = entryPoints(t, e.place, e.rebuys, e.addons);
      e.eliminated = true;
    }
  });
  t.results = t.entries.map((e) => ({ playerId: e.playerId, place: e.place!, points: e.points! })).sort((a, b) => a.place - b.place);
  t.status = 'finished';
  t.levelEndsAt = null;
  t.pausedRemaining = null;
  t.breakReturnRemaining = null;
  const champ = d.players.find((p) => p.id === order[0]);
  pushTicker(d, `${t.name} завершён! ${champ ? fullName(champ) : ''} — чемпион (+${t.results.find((r) => r.place === 1)?.points ?? 0} очков)`, 'alert');
}

function koWord(lang: 'ru' | 'en'): string {
  return lang === 'ru' ? 'очк.' : 'pts';
}

function freeSeats(t: Tournament): { tableId: string; seat: number }[] {
  const res: { tableId: string; seat: number }[] = [];
  for (const tb of t.tables) {
    const used = new Set(t.entries.filter((e) => e.tableId === tb.id && e.seat != null).map((e) => e.seat as number));
    for (let s2 = 1; s2 <= tb.seats; s2++) {
      if (!used.has(s2)) res.push({ tableId: tb.id, seat: s2 });
    }
  }
  return res;
}

function firstFreeSeat(t: Tournament, _prefer: string | null): { tableId: string; seat: number } | null {
  for (const tb of t.tables) {
    const used = new Set(t.entries.filter((e) => e.tableId === tb.id && e.seat != null).map((e) => e.seat as number));
    for (let s = 1; s <= tb.seats; s++) {
      if (!used.has(s)) return { tableId: tb.id, seat: s };
    }
  }
  return null;
}

// ---------- actions (полностью такие же, как были) ----------
export const actions = {
  /* settings / roles */
  setRole(role: Role) {
    return commit((d) => { d.settings.role = role; });
  },
  setSettings(patch: Partial<Settings>) {
    if (!can('club')) return false;
    return commit((d) => { d.settings = { ...d.settings, ...patch }; });
  },
  setScreenConfig(patch: Partial<ScreenConfig>) {
    if (!can('club')) return false;
    return commit((d) => { d.settings.screens = { ...d.settings.screens, ...patch }; });
  },

  /* players master list */
  addPlayer(data: { firstName: string; lastName: string; nickname: string; phone: string; avatarColor: string | null; avatarData?: string | null; joinedAt?: number; basePoints?: number }): string {
    const id = uid();
    if (!can('players')) return id;
    commit((d) => {
      d.players.push({ id, firstName: data.firstName, lastName: data.lastName, nickname: data.nickname, phone: data.phone, avatarColor: data.avatarColor, avatarData: data.avatarData ?? null, joinedAt: data.joinedAt ?? Date.now(), status: 'active', basePoints: data.basePoints ?? 0 });
    });
    return id;
  },
  updatePlayer(id: string, patch: Partial<Pick<Player, 'firstName' | 'lastName' | 'nickname' | 'phone' | 'avatarColor' | 'avatarData' | 'joinedAt'>>) {
    if (!can('players')) return false;
    return commit((d) => {
      const p = d.players.find((x) => x.id === id);
      if (p) Object.assign(p, patch);
    });
  },
  setPlayerStatus(id: string, status: PlayerStatus) {
    if (!can('players')) return false;
    return commit((d) => {
      const p = d.players.find((x) => x.id === id);
      if (p) p.status = status;
    });
  },
  deletePlayer(id: string) {
    if (!can('players')) return false;
    return commit((d) => { d.players = d.players.filter((x) => x.id !== id); });
  },

  /* seasons */
  addSeason(name: string): string {
    const id = uid();
    if (!can('structure')) return id;
    commit((d) => { d.seasons.push({ id, name, createdAt: Date.now() }); });
    return id;
  },
  saveTemplate(tpl: TournamentTemplate) {
    if (!can('structure')) return false;
    return commit((d) => {
      d.settings.tournamentTemplates = [tpl, ...d.settings.tournamentTemplates].slice(0, 24);
    });
  },
  deleteTemplate(id: string) {
    if (!can('structure')) return false;
    return commit((d) => {
      d.settings.tournamentTemplates = d.settings.tournamentTemplates.filter((x) => x.id !== id);
    });
  },
  updateSeason(id: string, patch: Partial<Pick<Season, 'name'>>) {
    if (!can('structure')) return false;
    if (!patch.name?.trim()) return false;
    return commit((d) => {
      const s = d.seasons.find((x) => x.id === id);
      if (s) s.name = patch.name!.trim();
    });
  },
  deleteSeason(id: string): boolean {
    if (!can('structure')) return false;
    if (state.tournaments.some((t) => t.seasonId === id)) return false;
    return commit((d) => {
      d.seasons = d.seasons.filter((s) => s.id !== id);
      if (d.settings.screens.boardSeasonId === id) d.settings.screens.boardSeasonId = null;
    });
  },
  setTemplate(patch: Partial<Pick<Settings, 'pointsTemplate' | 'participationTemplate' | 'rebuyPenaltyTemplate' | 'addonPenaltyTemplate'>>) {
    if (!can('structure')) return false;
    return commit((d) => { d.settings = { ...d.settings, ...patch }; });
  },

  /* tournaments */
  createTournament(fields: Partial<Tournament>): string {
    const id = uid();
    if (!can('structure')) return id;
    commit((d) => {
      const s = d.settings;
      const levels = fields.levels ?? blindLevels('classic');
      const t: Tournament = {
        id,
        name: fields.name || 'Новый турнир',
        date: fields.date ?? Date.now() + 86400_000,
        gameType: fields.gameType ?? 'holdem',
        description: fields.description ?? '',
        seasonId: fields.seasonId ?? null,
        status: 'scheduled',
        startingStack: fields.startingStack ?? 20000,
        registrationClosesAt: fields.registrationClosesAt !== undefined ? fields.registrationClosesAt : (fields.date ?? Date.now() + 86400_000) + 40 * 60_000,
        rebuyClosesAt: fields.rebuyClosesAt !== undefined ? fields.rebuyClosesAt : (fields.date ?? Date.now() + 86400_000) + 150 * 60_000,
        rebuyChips: fields.rebuyChips ?? (fields.startingStack ?? 20000),
        reentryChips: fields.reentryChips ?? (fields.startingStack ?? 20000),
        addonChips: fields.addonChips ?? Math.round((fields.startingStack ?? 20000) / 2),
        bonuses: fields.bonuses ?? defaultBonuses(),
        knockoutPointsEnabled: fields.knockoutPointsEnabled ?? true,
        knockoutPoints: fields.knockoutPoints ?? 3,
        levels,
        levelIndex: 0,
        levelEndsAt: null,
        pausedRemaining: null,
        pausedFromBreak: false,
        breakReturnRemaining: null,
        tables: [
          { id: uid(), name: 'Стол 1', seats: 9 },
          { id: uid(), name: 'Стол 2', seats: 9 },
        ],
        entries: [],
        pointsGrid: s.pointsTemplate.map((r) => ({ ...r })),
        participationPoints: s.participationTemplate,
        rebuyPenalty: s.rebuyPenaltyTemplate,
        addonPenalty: s.addonPenaltyTemplate,
        results: null,
        createdAt: Date.now(),
      };
      d.tournaments.push(t);
      d.activeTournamentId = id;
    });
    return id;
  },
  updateTournament(id: string, patch: Partial<Tournament>) {
    if (!can('structure')) return false;
    return commit((d) => {
      const t = findT(d, id);
      if (t) Object.assign(t, patch);
    });
  },
  deleteTournament(id: string) {
    if (!can('structure')) return false;
    return commit((d) => {
      d.tournaments = d.tournaments.filter((t) => t.id !== id);
      if (d.activeTournamentId === id) d.activeTournamentId = null;
    });
  },
  setActive(id: string) {
    return commit((d) => { d.activeTournamentId = id; });
  },

  /* registration */
  toggleEntry(tId: string, playerId: string) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      const p = d.players.find((x) => x.id === playerId);
      if (!t || !p) return;
      if (t.status === 'finished') return;
      const existing = t.entries.find((e) => e.playerId === playerId);
      if (existing) {
        if (LIVE_STATUSES.includes(t.status) && regClosed(t)) return;
        t.entries = t.entries.filter((e) => e.playerId !== playerId);
        return;
      }
      if (regClosed(t)) return;
      if (p.status !== 'active') return;
      t.entries.push(freshEntry(t, playerId));
      if (t.status === 'scheduled') t.status = 'registration';
      if (LIVE_STATUSES.includes(t.status)) pushTicker(d, `${fullName(p)} — поздняя регистрация в «${t.name}»`, 'info');
    });
  },
  registerAll(tId: string) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t || (t.status !== 'scheduled' && t.status !== 'registration')) return;
      if (regClosed(t)) return;
      for (const p of d.players) {
        if (p.status !== 'active') continue;
        if (t.entries.some((e) => e.playerId === p.id)) continue;
        t.entries.push(freshEntry(t, p.id));
      }
      if (t.entries.length > 0 && t.status === 'scheduled') t.status = 'registration';
    });
  },
  clearEntries(tId: string) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t || (t.status !== 'scheduled' && t.status !== 'registration')) return;
      t.entries = [];
    });
  },

  /* live control */
  start(tId: string) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t || t.levels.length === 0) return;
      if (t.status === 'running' || t.status === 'paused' || t.status === 'break' || t.status === 'finished') return;
      if (t.entries.length < 2) return;
      d.activeTournamentId = tId;
      t.status = 'running';
      t.levelIndex = 0;
      const lvl = t.levels[0];
      t.levelEndsAt = Date.now() + lvl.duration * 60_000;
      t.pausedRemaining = null;
      t.breakReturnRemaining = null;
      if (lvl.isBreak) t.status = 'break';
      pushTicker(d, `${t.name}: старт! ${lvl.isBreak ? 'перерыв' : `${fmtInt(lvl.sb)}/${fmtInt(lvl.bb)}`}`, lvl.isBreak ? 'break' : 'level');
    });
  },
  pause(tId: string) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t || (t.status !== 'running' && t.status !== 'break')) return;
      t.pausedFromBreak = t.status === 'break';
      t.pausedRemaining = nowRemaining(t);
      t.levelEndsAt = null;
      t.status = 'paused';
    });
  },
  resume(tId: string) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t || t.status !== 'paused') return;
      const rem = t.pausedRemaining ?? (t.levels[t.levelIndex]?.duration ?? 10) * 60;
      t.levelEndsAt = Date.now() + rem * 1000;
      t.pausedRemaining = null;
      t.status = t.pausedFromBreak ? 'break' : 'running';
    });
  },
  nextLevel(tId: string) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t || !LIVE_STATUSES.includes(t.status)) return;
      let idx = t.levelIndex;
      if (idx >= t.levels.length - 1) {
        const cur = t.levels[idx];
        if (cur && !cur.isBreak) {
          t.levelEndsAt = Date.now() + cur.duration * 60_000;
          t.status = 'running';
          t.breakReturnRemaining = null;
          t.pausedRemaining = null;
        }
        return;
      }
      idx += 1;
      const lvl = t.levels[idx];
      applyLevelStart(t, idx);
      if (lvl.isBreak) {
        pushTicker(d, `${t.name}: перерыв ${lvl.duration} мин`, 'break');
      } else {
        pushTicker(d, `${t.name}: уровень ${levelNumber(d, t, idx)} — ${fmtInt(lvl.sb)}/${fmtInt(lvl.bb)}${lvl.ante ? `, анте ${fmtInt(lvl.ante)}` : ''}`, 'level');
      }
    });
  },
  breakNow(tId: string, minutes: number) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t || t.status !== 'running') return;
      t.breakReturnRemaining = nowRemaining(t);
      t.status = 'break';
      t.levelEndsAt = Date.now() + minutes * 60_000;
      t.pausedRemaining = null;
      pushTicker(d, `${t.name}: перерыв ${minutes} мин`, 'break');
    });
  },
  endBreak(tId: string) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t || t.status !== 'break') return;
      const cur = t.levels[t.levelIndex];
      if (cur?.isBreak) {
        const idx = t.levels.findIndex((l, i) => i > t.levelIndex && !l.isBreak);
        if (idx >= 0) {
          const lvl = t.levels[idx];
          applyLevelStart(t, idx);
          pushTicker(d, `${t.name}: уровень ${levelNumber(d, t, idx)} — ${fmtInt(lvl.sb)}/${fmtInt(lvl.bb)}`, 'level');
        } else if (cur) {
          applyLevelStart(t, t.levelIndex);
        }
      } else {
        t.status = 'running';
        t.levelEndsAt = Date.now() + (t.breakReturnRemaining ?? (cur?.duration ?? 10) * 60) * 1000;
        t.breakReturnRemaining = null;
      }
      pushTicker(d, 'Перерыв окончен — игра продолжается', 'info');
    });
  },
  addTime(tId: string, deltaSec: number) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t) return;
      if (t.status === 'running' || t.status === 'break') {
        if (t.levelEndsAt) t.levelEndsAt = Math.max(Date.now() + 5000, t.levelEndsAt + deltaSec * 1000);
      } else if (t.status === 'paused' && t.pausedRemaining != null) {
        t.pausedRemaining = Math.max(5, t.pausedRemaining + deltaSec);
      }
    });
  },
  resetTimer(tId: string) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t) return;
      const lvl = t.levels[t.levelIndex];
      if (!lvl) return;
      if (t.status === 'running' || t.status === 'break') t.levelEndsAt = Date.now() + lvl.duration * 60_000;
      else if (t.status === 'paused') t.pausedRemaining = lvl.duration * 60;
    });
  },

  /* players in tournament */
  eliminate(tId: string, playerId: string, byId: string | null) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t || !LIVE_STATUSES.includes(t.status)) return;
      const e = t.entries.find((x) => x.playerId === playerId);
      if (!e || e.eliminated) return;
      const p = d.players.find((x) => x.id === playerId);
      const killer = byId ? d.players.find((x) => x.id === byId) : null;
      const activeBefore = t.entries.filter((x) => !x.eliminated).length;
      e.eliminated = true;
      e.place = activeBefore;
      e.eliminatedBy = byId;
      e.stack = 0;
      e.lastTableId = e.tableId;
      e.lastSeat = e.seat;
      e.tableId = null;
      e.seat = null;
      const lvl = t.levels[t.levelIndex];
      e.outLevel = lvl && !lvl.isBreak ? levelNumber(d, t, t.levelIndex) : e.outLevel;
      let koNote = '';
      if (t.knockoutPointsEnabled && byId && byId !== playerId) {
        const killerEntry = t.entries.find((x) => x.playerId === byId);
        if (killerEntry) {
          killerEntry.livePoints += t.knockoutPoints;
          killerEntry.knockouts += 1;
          koNote = ` · ${fullName(killer!)} +${t.knockoutPoints} ${koWord(d.settings.language)}`;
        }
      }
      const left = activeBefore - 1;
      const canComeback = !rebuyClosed(t);
      pushTicker(
        d,
        `${p ? fullName(p) : 'Игрок'} выбывает${killer ? ` — выбил ${fullName(killer)}` : ''}${koNote} · в игре ${left}${left === 1 && canComeback ? ' · окно докупок открыто' : ''}`,
        'alert',
      );
      if (left === 1 && !canComeback) {
        const champ = t.entries.find((x) => !x.eliminated);
        if (champ) finalizeInner(d, t, [champ.playerId, ...t.entries.filter((x) => x.eliminated).sort((a, b) => (b.place ?? 0) - (a.place ?? 0)).map((x) => x.playerId)], true);
      }
    });
  },
  rebuyStack(tId: string, playerId: string, kind: 'rebuy' | 'addon') {
    if (!can('live')) return false;
    if (rebuyClosedById(tId)) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t || !LIVE_STATUSES.includes(t.status)) return;
      const e = t.entries.find((x) => x.playerId === playerId);
      if (!e) return;
      const p = d.players.find((x) => x.id === playerId);
      const comeback = e.eliminated;
      if (kind === 'rebuy') e.rebuys += 1;
      else e.addons += 1;
      const chips = kind === 'rebuy' ? t.rebuyChips : t.addonChips;
      if (comeback) {
        revive(d, t, e, chips);
        pushTicker(d, `${p ? fullName(p) : 'Игрок'} возвращается в игру (${kind === 'rebuy' ? 'ребай' : 'адд-он'}) +${fmtInt(chips)}!`, 'alert');
      } else {
        e.stack += chips;
      }
    });
  },
  reentry(tId: string, playerId: string) {
    if (!can('live')) return false;
    if (rebuyClosedById(tId)) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t || !LIVE_STATUSES.includes(t.status)) return;
      const e = t.entries.find((x) => x.playerId === playerId);
      if (!e) return;
      const p = d.players.find((x) => x.id === playerId);
      e.entries += 1;
      revive(d, t, e, t.reentryChips);
      pushTicker(d, `${p ? fullName(p) : 'Игрок'} — ре-ентри (вход №${e.entries}) +${fmtInt(t.reentryChips)}!`, 'alert');
    });
  },
  addBonus(tId: string, playerId: string, chips: number, reason: string) {
    if (!can('live')) return false;
    if (chips <= 0) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t || !LIVE_STATUSES.includes(t.status)) return;
      const e = t.entries.find((x) => x.playerId === playerId);
      if (!e || e.eliminated) return;
      e.stack += chips;
      e.bonusLog.push({ time: Date.now(), chips, reason: reason.trim() || 'Бонус' });
      const p = d.players.find((x) => x.id === playerId);
      pushTicker(d, `${p ? fullName(p) : 'Игрок'}: бонус +${fmtInt(chips)} (${reason.trim() || 'бонус'})`, 'custom');
    });
  },

  /* seating */
  seatRandom(tId: string, playerId: string | null) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t || t.tables.length === 0) return;
      const targets = playerId
        ? t.entries.filter((e) => e.playerId === playerId && !e.eliminated)
        : t.entries.filter((e) => !e.eliminated && e.tableId == null);
      for (const e of targets) {
        const free = freeSeats(t);
        if (free.length === 0) break;
        const pick = free[Math.floor(Math.random() * free.length)];
        e.tableId = pick.tableId;
        e.seat = pick.seat;
      }
    });
  },
  assignSeat(tId: string, playerId: string, tableId: string, seat: number) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t) return;
      const e = t.entries.find((x) => x.playerId === playerId);
      const table = t.tables.find((x) => x.id === tableId);
      if (!e || !table || e.eliminated) return;
      if (seat < 1 || seat > table.seats) return;
      const occupant = t.entries.find((x) => x.tableId === tableId && x.seat === seat && x.playerId !== playerId);
      const fromTable = e.tableId;
      const fromSeat = e.seat;
      if (occupant) {
        if (fromTable && fromSeat) {
          occupant.tableId = fromTable;
          occupant.seat = fromSeat;
        } else {
          const free = firstFreeSeat(t, null);
          occupant.tableId = free?.tableId ?? null;
          occupant.seat = free?.seat ?? null;
        }
      }
      e.tableId = tableId;
      e.seat = seat;
    });
  },
  unseat(tId: string, playerId: string) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      const e = t?.entries.find((x) => x.playerId === playerId);
      if (e) {
        e.tableId = null;
        e.seat = null;
      }
    });
  },
  autoSeat(tId: string, mode: AutoSeatMode) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t) return;
      const points = new Map(leaderboardRows(d.players, d.tournaments, null).map((r) => [r.playerId, r.points]));
      const plan = autoSeatPlan(t.entries, t.tables, mode, (pid) => points.get(pid) ?? 0);
      t.entries.forEach((e) => {
        if (e.eliminated) return;
        const target = plan.get(e.playerId);
        e.tableId = target?.tableId ?? null;
        e.seat = target?.seat ?? null;
      });
    });
  },
  applySuggestion(tId: string, s: Suggestion) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t) return;
      const e = t.entries.find((x) => x.playerId === s.playerId);
      const to = t.tables.find((x) => x.id === s.toId);
      if (!e || !to) return;
      const used = new Set(t.entries.filter((x) => x.tableId === to.id && x.seat != null).map((x) => x.seat as number));
      let seat = 1;
      while (used.has(seat) && seat <= to.seats) seat++;
      if (seat > to.seats) return;
      e.tableId = to.id;
      e.seat = seat;
    });
  },
  addTable(tId: string, seats: number) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t) return;
      t.tables.push({ id: uid(), name: `Стол ${t.tables.length + 1}`, seats });
    });
  },
  updateTable(tId: string, tableId: string, patch: Partial<TableT>) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      const tb = t?.tables.find((x) => x.id === tableId);
      if (!tb) return;
      if (patch.name !== undefined) tb.name = patch.name;
      if (patch.seats !== undefined) {
        tb.seats = Math.max(2, patch.seats);
        t!.entries.forEach((e) => {
          if (e.tableId === tableId && e.seat != null && e.seat > tb.seats) {
            e.tableId = null;
            e.seat = null;
          }
        });
      }
    });
  },
  removeTable(tId: string, tableId: string) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t) return;
      t.tables = t.tables.filter((x) => x.id !== tableId);
      t.entries.forEach((e) => {
        if (e.tableId === tableId) {
          e.tableId = null;
          e.seat = null;
        }
      });
    });
  },

  /* structure per tournament */
  addLevel(tId: string, isBreak: boolean) {
    if (!can('structure')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t) return;
      const play = t.levels.filter((l) => !l.isBreak);
      const last = play.length ? play[play.length - 1] : undefined;
      t.levels.push(
        isBreak
          ? { id: uid(), sb: 0, bb: 0, ante: 0, duration: 10, isBreak: true }
          : { id: uid(), sb: (last?.sb ?? 25) * 2, bb: (last?.bb ?? 50) * 2, ante: (last?.ante ?? 0) * 2, duration: last?.duration ?? 12, isBreak: false },
      );
    });
  },
  updateLevel(tId: string, levelId: string, patch: Partial<BlindLevel>) {
    if (!can('structure')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      const l = t?.levels.find((x) => x.id === levelId);
      if (l) Object.assign(l, patch);
    });
  },
  removeLevel(tId: string, levelId: string) {
    if (!can('structure')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t) return;
      t.levels = t.levels.filter((x) => x.id !== levelId);
      if (t.levelIndex >= t.levels.length) t.levelIndex = Math.max(0, t.levels.length - 1);
    });
  },
  moveLevel(tId: string, levelId: string, dir: -1 | 1) {
    if (!can('structure')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t) return;
      const idx = t.levels.findIndex((x) => x.id === levelId);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= t.levels.length) return;
      const [lvl] = t.levels.splice(idx, 1);
      t.levels.splice(to, 0, lvl);
    });
  },
  loadStructure(tId: string, levels: BlindLevel[]) {
    if (!can('structure')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t) return;
      t.levels = levels;
      t.levelIndex = 0;
    });
  },

  /* points per tournament */
  setPointsGrid(tId: string, rows: PointsRow[]) {
    if (!can('structure')) return false;
    const t = state.tournaments.find((x) => x.id === tId);
    if (t && t.status !== 'scheduled' && t.status !== 'registration') return false;
    return commit((d) => {
      const tt = findT(d, tId);
      if (tt) tt.pointsGrid = rows;
    });
  },
  setParticipation(tId: string, n: number) {
    if (!can('structure')) return false;
    const t = state.tournaments.find((x) => x.id === tId);
    if (t && t.status !== 'scheduled' && t.status !== 'registration') return false;
    return commit((d) => {
      const tt = findT(d, tId);
      if (tt) tt.participationPoints = Math.max(0, n);
    });
  },
  setPenalties(tId: string, patch: { rebuy?: number; addon?: number }) {
    if (!can('structure')) return false;
    const t = state.tournaments.find((x) => x.id === tId);
    if (t && t.status !== 'scheduled' && t.status !== 'registration') return false;
    return commit((d) => {
      const tt = findT(d, tId);
      if (!tt) return;
      if (patch.rebuy !== undefined) tt.rebuyPenalty = Math.max(0, patch.rebuy);
      if (patch.addon !== undefined) tt.addonPenalty = Math.max(0, patch.addon);
    });
  },

  /* finalize */
  finalize(tId: string, order: string[]) {
    if (!can('live')) return false;
    return commit((d) => {
      const t = findT(d, tId);
      if (!t || t.status === 'finished') return;
      finalizeInner(d, t, order, false);
    });
  },
  checkAutoFinish(tId: string) {
    const t = state.tournaments.find((x) => x.id === tId);
    if (!t || t.status === 'finished' || !LIVE_STATUSES.includes(t.status)) return;
    if (!rebuyClosed(t)) return;
    const active = t.entries.filter((e) => !e.eliminated);
    if (t.entries.length > 1 && active.length === 1) {
      commit((d) => {
        const tt = findT(d, tId);
        if (!tt) return;
        const champ = tt.entries.find((x) => !x.eliminated);
        if (!champ) return;
        finalizeInner(d, tt, [champ.playerId, ...tt.entries.filter((x) => x.eliminated).sort((a, b) => (b.place ?? 0) - (a.place ?? 0)).map((x) => x.playerId)], true);
      });
    }
  },

  /* ticker / backup */
  sendTicker(text: string) {
    if (!can('live')) return false;
    return commit((d) => pushTicker(d, text, 'custom'));
  },
  clearTicker() {
    if (!can('live')) return false;
    return commit((d) => { d.ticker = []; });
  },
  replaceAll(next: AppState) {
    state = normalize({ ...next, rev: state.rev + 1, savedAt: Date.now() });
    persist(true);
    emit();
  },
};

// ---------- Селекторы ----------
export function remainingSeconds(s: AppState, t: Tournament | null): number | null {
  if (!t) return null;
  if (t.status === 'paused') return t.pausedRemaining;
  if (t.status === 'running' || t.status === 'break') {
    if (!t.levelEndsAt) return null;
    return Math.max(0, Math.round((t.levelEndsAt - Date.now()) / 1000));
  }
  return null;
}

export function useActive(): { s: AppState; t: Tournament | null } {
  const s = useApp();
  return { s, t: getActiveTournament(s) };
}

// ---------- Переэкспорт утилит ----------
export { balanceSuggestions, liveStats, fmtChips };