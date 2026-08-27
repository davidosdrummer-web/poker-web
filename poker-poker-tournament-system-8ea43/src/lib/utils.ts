import type { Lang, Player, TableT, Tournament, TournamentEntry } from './types';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------------- formatting ---------------- */

export const fmtInt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n));
export const fmtChips = (n: number) => (n >= 1000 && n % 1000 === 0 ? `${n / 1000}K` : fmtInt(n));

/** правило клуба: больше часа — Ч:ММ:СС, меньше — ММ:СС */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(r)}`;
  return `${pad(m)}:${pad(r)}`;
}

export const fmtTimeOfDay = (ts: number) =>
  new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export function fmtDate(ts: number, lang: Lang): string {
  return new Date(ts).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(ts: number, lang: Lang): string {
  return new Date(ts).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function downloadFile(name: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------------- players ---------------- */

export const fullName = (p: Player) => `${p.lastName} ${p.firstName}`.trim();
export const shortName = (p: Player) => `${p.firstName} ${p.lastName.charAt(0)}.`.trim();

export function avatarHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

/** позиции мест вокруг овального стола (в процентах контейнера) */
export function seatPositions(n: number): { x: number; y: number }[] {
  const res: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (-90 + (360 / n) * i) * (Math.PI / 180);
    res.push({ x: 50 + 46.5 * Math.cos(a), y: 50 + 43.5 * Math.sin(a) });
  }
  return res;
}

/** чтение изображения в dataURL со сжатием (для аватаров и логотипа) */
export function readImageFile(file: File, maxSize: number, cb: (data: string | null, err?: string) => void): void {
  if (file.size > 2 * 1024 * 1024) {
    cb(null, 'avatarTooBig');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        cb(String(reader.result));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      cb(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => cb(null, 'avatarTooBig');
    img.src = String(reader.result);
  };
  reader.onerror = () => cb(null, 'avatarTooBig');
  reader.readAsDataURL(file);
}

/* ---------------- points ---------------- */

export function entryPoints(t: Tournament, place: number, rebuys = 0, addons = 0): number {
  const row = t.pointsGrid.find((r) => r.place === place);
  const base = row ? row.points : t.participationPoints;
  const penalty = rebuys * t.rebuyPenalty + addons * t.addonPenalty;
  return Math.max(0, base - penalty);
}

/* ---------------- leaderboard ---------------- */

export interface LbRow {
  playerId: string;
  points: number;
  played: number;
  wins: number;
  top3: number;
  finals: number;
  best: number;
  knockouts: number;
  rebuyCount: number;
}

export function leaderboardRows(
  players: Player[],
  tournaments: Tournament[],
  seasonId: string | null,
  excludeTournamentId?: string,
  periodStart?: number | null
): LbRow[] {
  const acc = new Map<string, LbRow>();
  const row = (pid: string): LbRow => {
    let r = acc.get(pid);
    if (!r) {
      r = {
        playerId: pid,
        points: 0,
        played: 0,
        wins: 0,
        top3: 0,
        finals: 0,
        best: 0,
        knockouts: 0,
        rebuyCount: 0,
      };
      acc.set(pid, r);
    }
    return r;
  };

  if (!seasonId) {
    for (const p of players) {
      if (p.basePoints > 0) row(p.id).points += p.basePoints;
      if (p.knockouts > 0) row(p.id).knockouts = p.knockouts;
      if (p.rebuyCount > 0) row(p.id).rebuyCount = p.rebuyCount;
    }
  }

  for (const t of tournaments) {
    if (seasonId && t.seasonId !== seasonId) continue;
    if (excludeTournamentId && t.id === excludeTournamentId) continue;
    if (periodStart && t.date < periodStart) continue;
    const finished = t.status === 'finished';
    for (const e of t.entries) {
      const r = row(e.playerId);
      const player = players.find(p => p.id === e.playerId);
      if (player) {
        r.knockouts = player.knockouts || 0;
        r.rebuyCount = player.rebuyCount || 0;
      }
      if (e.livePoints > 0) r.points += e.livePoints;
      if (!finished) continue;
      if (e.place == null || e.points == null) continue;
      r.played += 1;
      r.points += e.points;
      if (e.place === 1) r.wins += 1;
      if (e.place <= 3) r.top3 += 1;
      if (e.place <= 9) r.finals += 1;
      r.best = Math.max(r.best, e.points + e.livePoints);
    }
  }

  const nameOf = (pid: string) => {
    const p = players.find((x) => x.id === pid);
    return p ? fullName(p) : '';
  };

  return [...acc.values()]
    .filter((r) => r.played > 0 || r.points > 0)
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.top3 - a.top3 || nameOf(a.playerId).localeCompare(nameOf(b.playerId)));
}

export function rankMap(rows: LbRow[]): Map<string, number> {
  const m = new Map<string, number>();
  rows.forEach((r, i) => m.set(r.playerId, i + 1));
  return m;
}

/* ---------------- live tournament stats ---------------- */

export interface LiveStats {
  registered: number;
  active: number;
  eliminated: number;
  totalChips: number;
  avgStack: number;
  rebuys: number;
  addons: number;
}

export function liveStats(t: Tournament): LiveStats {
  const active = t.entries.filter((e) => !e.eliminated);
  const totalChips = active.reduce((a, e) => a + e.stack, 0);
  return {
    registered: t.entries.length,
    active: active.length,
    eliminated: t.entries.length - active.length,
    totalChips,
    avgStack: active.length ? Math.round(totalChips / active.length) : 0,
    rebuys: t.entries.reduce((a, e) => a + e.rebuys, 0),
    addons: t.entries.reduce((a, e) => a + e.addons, 0),
  };
}

/* ---------------- seating ---------------- */

export type AutoSeatMode = 'random' | 'rating';

export function autoSeatPlan(
  entries: TournamentEntry[],
  tables: TableT[],
  mode: AutoSeatMode,
  weightOf: (playerId: string) => number,
): Map<string, { tableId: string; seat: number }> {
  const eligible = entries.filter((e) => !e.eliminated);
  const plan = new Map<string, { tableId: string; seat: number }>();
  if (tables.length === 0) return plan;

  if (mode === 'random') {
    const players = shuffle(eligible);
    const seats = shuffle(freeSeatList(tables, []));
    players.forEach((e, i) => {
      const seat = seats[i];
      if (seat) plan.set(e.playerId, seat);
    });
    return plan;
  }

  const ordered = [...eligible].sort((a, b) => weightOf(b.playerId) - weightOf(a.playerId));
  const counters = new Map<string, number>();
  let ti = 0;
  for (const e of ordered) {
    let guard = 0;
    while (guard++ < tables.length * 2) {
      const tb = tables[ti % tables.length];
      const used = counters.get(tb.id) ?? 0;
      if (used < tb.seats) {
        counters.set(tb.id, used + 1);
        plan.set(e.playerId, { tableId: tb.id, seat: used + 1 });
        break;
      }
      ti++;
    }
    ti++;
  }
  return plan;
}

export function freeSeatList(tables: TableT[], entries: TournamentEntry[]): { tableId: string; seat: number }[] {
  const taken = new Map<string, Set<number>>();
  for (const e of entries) {
    if (e.tableId != null && e.seat != null && !e.eliminated) {
      if (!taken.has(e.tableId)) taken.set(e.tableId, new Set());
      taken.get(e.tableId)!.add(e.seat);
    }
  }
  const res: { tableId: string; seat: number }[] = [];
  for (const tb of tables) {
    const used = taken.get(tb.id) ?? new Set<number>();
    for (let s2 = 1; s2 <= tb.seats; s2++) {
      if (!used.has(s2)) res.push({ tableId: tb.id, seat: s2 });
    }
  }
  return res;
}

export function freeSeats(t: Tournament): { tableId: string; seat: number }[] {
  return freeSeatList(t.tables, t.entries);
}

export interface Suggestion {
  playerId: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
}

export function balanceSuggestions(entries: TournamentEntry[], tables: TableT[]): Suggestion[] {
  if (tables.length < 2) return [];
  const counts = new Map<string, number>(tables.map((t) => [t.id, 0]));
  const seated = entries.filter((e) => !e.eliminated && e.tableId);
  for (const e of seated) counts.set(e.tableId!, (counts.get(e.tableId!) ?? 0) + 1);
  const sugs: Suggestion[] = [];
  for (let iter = 0; iter < 20; iter++) {
    let maxT: TableT | null = null;
    let minT: TableT | null = null;
    for (const t of tables) {
      const c = counts.get(t.id) ?? 0;
      if (!maxT || c > (counts.get(maxT.id) ?? 0)) maxT = t;
      if (!minT || c < (counts.get(minT.id) ?? 0)) minT = t;
    }
    if (!maxT || !minT || maxT.id === minT.id) break;
    const diff = (counts.get(maxT.id) ?? 0) - (counts.get(minT.id) ?? 0);
    if (diff < 2) break;
    const candidates = seated.filter((e) => e.tableId === maxT.id && !sugs.some((s) => s.playerId === e.playerId));
    if (candidates.length === 0) break;
    const pick = [...candidates].sort((a, b) => a.stack - b.stack)[0];
    sugs.push({ playerId: pick.playerId, fromId: maxT.id, fromName: maxT.name, toId: minT.id, toName: minT.name });
    counts.set(maxT.id, (counts.get(maxT.id) ?? 0) - 1);
    counts.set(minT.id, (counts.get(minT.id) ?? 0) + 1);
  }
  return sugs;
}

/* ---------------- audio ---------------- */

let audioCtx: AudioContext | null = null;

export function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    /* audio unsupported */
  }
}

export function playBell(times = 2) {
  unlockAudio();
  if (!audioCtx) return;
  for (let i = 0; i < times; i++) {
    const t0 = audioCtx.currentTime + i * 0.55;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(660, t0 + 0.4);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.55);
  }
}

export function speak(text: string, lang: Lang) {
  try {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'ru' ? 'ru-RU' : 'en-US';
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function announce(text: string, mode: 'off' | 'bell' | 'voice', lang: Lang) {
  if (mode === 'off') return;
  unlockAudio();
  if (mode === 'voice') speak(text, lang);
  else playBell(2);
}