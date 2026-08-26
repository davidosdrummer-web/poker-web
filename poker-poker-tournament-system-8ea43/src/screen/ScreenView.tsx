import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { AppState, ScreenMode, Tournament } from '../lib/types';
import { getActiveTournament, regClosed, remainingSeconds, useApp } from '../lib/store';
import { makeT, type TFunc } from '../lib/i18n';
import { announce, fmtChips, fmtClock, fmtDate, fmtDateTime, fmtInt, fmtTimeOfDay, fullName, leaderboardRows, liveStats, rankMap, seatPositions, unlockAudio } from '../lib/utils';
import { playSfx } from '../lib/sfx';
import { Avatar, Icon } from '../components/ui';

function levelNumberOf(t: Tournament, idx: number): number {
  return t.levels.slice(0, idx + 1).filter((l) => !l.isBreak).length;
}

function nextPlayLevel(t: Tournament): { level: Tournament['levels'][number]; num: number } | null {
  for (let i = t.levelIndex + 1; i < t.levels.length; i++) {
    if (!t.levels[i].isBreak) {
      return { level: t.levels[i], num: t.levels.slice(0, i + 1).filter((l) => !l.isBreak).length };
    }
  }
  return null;
}

export function ScreenView({ mode, preview = false }: { mode: ScreenMode; preview?: boolean }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [flash, setFlash] = useState(false);
  const prevKey = useRef<string | null>(null);

  const active = getActiveTournament(s);
  const liveTarget = active;
  const finishedTarget = useMemo(() => {
    if (active?.status === 'finished') return active;
    const fin = s.tournaments.filter((x) => x.status === 'finished');
    return fin.length ? fin.sort((a, b) => b.date - a.date)[0] : null;
  }, [s.tournaments, active]);

  /* clock */
  useEffect(() => {
    const id = window.setInterval(force, 250);
    return () => window.clearInterval(id);
  }, []);

  /* audio unlock */
  useEffect(() => {
    const h = () => unlockAudio();
    window.addEventListener('pointerdown', h, { once: true });
    window.addEventListener('keydown', h, { once: true });
    return () => {
      window.removeEventListener('pointerdown', h);
      window.removeEventListener('keydown', h);
    };
  }, []);

  /* level / status change -> flash + sound */
  const key = liveTarget ? `${liveTarget.id}:${liveTarget.status}:${liveTarget.levelIndex}` : 'none';
  useEffect(() => {
    if (prevKey.current && prevKey.current !== key && !preview && liveTarget) {
      setFlash(true);
      const to = window.setTimeout(() => setFlash(false), 4800);
      const lvl = liveTarget.levels[liveTarget.levelIndex];
      if (lvl) {
        if (liveTarget.status === 'break') {
          announce(`${t('break')}. ${lvl.duration} ${t('minutes')}.`, s.settings.sound, s.settings.language);
        } else if (!lvl.isBreak) {
          const num = levelNumberOf(liveTarget, liveTarget.levelIndex);
          announce(
            `${t('level')} ${num}. ${t('blinds')} ${fmtInt(lvl.sb)} ${fmtInt(lvl.bb)}.` + (lvl.ante ? ` ${t('ante')} ${fmtInt(lvl.ante)}.` : ''),
            s.settings.sound,
            s.settings.language,
          );
        }
      }
      window.clearTimeout(to);
      return () => window.clearTimeout(to);
    }
    prevKey.current = key;
    return undefined;
  }, [key, liveTarget, t, preview, s.settings.sound, s.settings.language]);

  /* звуковые события: старт, выбивание, уровень, перерыв, докупки, финал */
  const sfxPrev = useRef<{ status: string; elim: number; reb: number; add: number; ent: number; lvl: number } | null>(null);
  useEffect(() => {
    if (!liveTarget) {
      sfxPrev.current = null;
      return;
    }
    const el = liveTarget;
    const cur = {
      status: el.status,
      elim: el.entries.filter((e) => e.eliminated).length,
      reb: el.entries.reduce((a, e) => a + e.rebuys, 0),
      add: el.entries.reduce((a, e) => a + e.addons, 0),
      ent: el.entries.reduce((a, e) => a + e.entries, 0),
      lvl: el.levelIndex,
    };
    const prev = sfxPrev.current;
    if (prev && s.settings.sfx !== false && !preview) {
      if (cur.status === 'running' && prev.status === 'registration') playSfx('start', true);
      else if (cur.status === 'break' && prev.status !== 'break') playSfx('break', true);
      else if (cur.lvl !== prev.lvl && cur.status === 'running') playSfx('level', true);
      if (cur.elim > prev.elim) playSfx('eliminate', true);
      if (cur.reb > prev.reb) playSfx('rebuy', true);
      if (cur.add > prev.add) playSfx('addon', true);
      if (cur.ent > prev.ent) playSfx('reentry', true);
      if (cur.status === 'finished' && prev.status !== 'finished') playSfx('end', true);
    }
    sfxPrev.current = cur;
  }, [s.rev, liveTarget, preview, s.settings.sfx]);

  const [clock, setClock] = useState('');
  useEffect(() => {
    const f = () =>
      setClock(
        new Date().toLocaleTimeString(s.settings.language === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      );
    f();
    const id = window.setInterval(f, 1000);
    return () => window.clearInterval(id);
  }, [s.settings.language]);

  const headerTournament = mode === 'results' ? finishedTarget : liveTarget;
  const status = headerTournament?.status;
  const isBreak = status === 'break';
  const statusTone =
    status === 'running' ? t('status.running') : status === 'paused' ? t('status.paused') : status === 'break' ? t('status.break') : status === 'finished' ? t('status.finished') : status === 'registration' ? t('status.registration') : status === 'scheduled' ? t('status.scheduled') : null;
  const accent = s.settings.accent;

  return (
    <div className="screen-root bg-felt-screen suit-pattern h-full w-full flex flex-col overflow-hidden relative text-cream-100 select-none" style={{ ['--acc' as string]: accent }}>
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 16cqw rgba(0,0,0,0.55)' }} />

      {/* header */}
      <div className="relative flex items-center gap-[1.2cqw] px-[2cqw] py-[1cqw] border-b border-[rgba(242,193,78,0.14)]">
        {s.settings.logo ? (
          <img src={s.settings.logo} alt="" className="rounded-xl object-contain shrink-0" style={{ width: '3.1cqw', height: '3.1cqw', background: 'rgba(242,193,78,0.05)', boxShadow: `inset 0 0 0 2px ${accent}55` }} />
        ) : (
          <svg viewBox="0 0 64 64" style={{ width: '3.1cqw', height: '3.1cqw' }} aria-hidden="true">
            <rect x="1.5" y="1.5" width="61" height="61" rx="12.5" fill="rgba(242,193,78,0.06)" stroke={accent} strokeOpacity="0.5" strokeWidth="2" />
            <path d="M32 10c6.5 8.4 15 13.9 15 22.3a8.5 8.5 0 0 1-13.2 7.1c.5 4.3 2.2 8 4.7 10.8H25.5c2.5-2.8 4.2-6.5 4.7-10.8A8.5 8.5 0 0 1 17 32.3C17 23.9 25.5 18.4 32 10z" fill={accent} />
          </svg>
        )}
        <div className="min-w-0">
          <div className="font-display leading-none text-[color:var(--acc)]" style={{ fontSize: '2cqw' }}>
            {s.settings.clubName.toUpperCase()}
          </div>
          <div className="screen-label text-cream-500 truncate font-semibold tracking-wide">
            {headerTournament ? headerTournament.name : t('app.tagline')}
          </div>
        </div>
        <div className="flex-1" />
        {statusTone && (
          <div
            className={`font-display px-[1cqw] py-[0.35cqw] rounded-md border tracking-widest ${
              status === 'running' ? 'text-win border-win/40 bg-win/10' : isBreak ? 'text-gold-300 border-gold-400/40 bg-gold-400/10' : status === 'paused' ? 'text-loss border-loss/40 bg-loss/10' : 'text-cream-300 border-line bg-felt-800/60'
            }`}
            style={{ fontSize: '1.45cqw' }}
          >
            {status === 'running' && <span className="inline-block w-[0.7cqw] h-[0.7cqw] rounded-full bg-win mr-[0.5cqw] anim-pulse-soft" />}
            {statusTone.toUpperCase()}
          </div>
        )}
        <div className="font-display num text-cream-300" style={{ fontSize: '1.9cqw' }}>
          {clock}
        </div>
        {!preview && (
          <button
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void document.documentElement.requestFullscreen();
            }}
            className="p-[0.5cqw] rounded-md border border-line text-cream-500 hover:text-gold-300 hover:border-gold-400/40 transition-colors"
          >
            <Icon name="expand" size={0} className="w-[1.4cqw] h-[1.4cqw]" />
          </button>
        )}
      </div>

      {mode === 'live' && <LiveBody s={s} t={t} target={liveTarget} flash={flash} />}
      {mode === 'tables' && <TablesBody s={s} t={t} target={liveTarget} />}
      {mode === 'table' && <LiveTableBody s={s} t={t} target={liveTarget} />}
      {mode === 'board' && <BoardBody s={s} t={t} />}
      {mode === 'results' && <ResultsBody s={s} t={t} target={finishedTarget} />}

      {s.settings.screens.showTicker && <Ticker s={s} />}
    </div>
  );
}

/* ================= LIVE ================= */

function LiveBody({ s, t, target, flash }: { s: AppState; t: TFunc; target: Tournament | null; flash: boolean }) {
  const remaining = remainingSeconds(s, target);
  const cfg = s.settings.screens;

  if (!target) {
    const next = s.tournaments
      .filter((x) => x.status === 'scheduled' || x.status === 'registration')
      .sort((a, b) => a.date - b.date)[0];
    const top = leaderboardRows(s.players, s.tournaments, null).slice(0, 5);
    return (
      <div className="relative flex-1 flex items-center justify-center gap-[4cqw] px-[4cqw]">
        <div className="flex flex-col items-center gap-[1.2cqw] text-center">
          <Icon name="spade" size={0} className="w-[6cqw] h-[6cqw] text-[color:var(--acc)]" filled />
          <div className="font-display text-[color:var(--acc)]" style={{ fontSize: '4.4cqw', lineHeight: 1 }}>
            {t('noActiveTournament').toUpperCase()}
          </div>
          {next && (
            <div className="rounded-xl border border-line-soft bg-felt-900/70 px-[2cqw] py-[1.2cqw]">
              <div className="screen-label uppercase tracking-[0.25em] text-cream-500 font-bold">{t('nextTournament')}</div>
              <div className="font-display text-cream-100" style={{ fontSize: '2.6cqw' }}>{next.name}</div>
              <div className="screen-sub text-gold-300 font-bold num">{fmtDateTime(next.date, s.settings.language)}</div>
            </div>
          )}
        </div>
        {top.length > 0 && (
          <div className="rounded-xl border border-line-soft bg-felt-900/60 px-[2cqw] py-[1.4cqw] min-w-[30cqw]">
            <div className="screen-label uppercase tracking-[0.25em] text-cream-500 font-bold mb-[0.8cqw]">{t('clubTop')}</div>
            {top.map((r, i) => {
              const p = s.players.find((x) => x.id === r.playerId);
              return (
                <div key={r.playerId} className="flex items-center gap-[1cqw] py-[0.35cqw]">
                  <span className="font-display num w-[2.4cqw] text-[color:var(--acc)]" style={{ fontSize: '2cqw' }}>{i + 1}</span>
                  <span className="screen-name font-semibold flex-1 truncate">{p ? fullName(p) : '—'}</span>
                  <span className="screen-sub num text-gold-300 font-bold">{r.points} {t('pts')}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const level = target.levels[target.levelIndex];
  const stats = liveStats(target);
  const nxt = nextPlayLevel(target);
  const st = target.status;
  const lvlTotal = (level?.duration ?? 1) * 60;
  const progress = remaining != null && level ? Math.max(0, Math.min(1, remaining / lvlTotal)) : 0;

  return (
    <div className="relative flex-1 flex flex-col min-h-0 px-[2cqw] py-[1.2cqw] gap-[1.2cqw]">
      <div className="flex gap-[1.6cqw] min-h-0 flex-1">
        {/* timer */}
        {cfg.showTimer && (
          <div className="flex-[1.25] flex flex-col justify-center items-center rounded-xl border border-[rgba(242,193,78,0.16)] bg-black/25 relative overflow-hidden">
            {st === 'registration' || st === 'scheduled' ? (
              <RegPanel s={s} t={t} target={target} stats={stats} />
            ) : st === 'finished' ? (
              <div className="flex flex-col items-center gap-[1cqw] text-center px-[2cqw]">
                <Icon name="trophy" size={0} className="w-[5cqw] h-[5cqw] text-[color:var(--acc)]" />
                <div className="font-display text-[color:var(--acc)]" style={{ fontSize: '5cqw' }}>
                  {t('timer.finished').toUpperCase()}
                </div>
              </div>
            ) : st === 'break' ? (
              <div className="flex flex-col items-center gap-[1cqw]">
                <Icon name="coffee" size={0} className="w-[5cqw] h-[5cqw] text-[color:var(--acc)]" />
                <div className="font-display text-[color:var(--acc)]" style={{ fontSize: '6cqw' }}>
                  {t('break').toUpperCase()}
                </div>
                <div className="font-display num text-cream-100 screen-timer">{remaining != null ? fmtClock(remaining) : '—'}</div>
                <div className="screen-label uppercase tracking-[0.3em] text-cream-500 font-bold">{t('timer.toBreakEnd')}</div>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full px-[1cqw]">
                <div className={`w-full flex items-end justify-between px-[1.5cqw] ${flash ? 'anim-level-flash' : ''}`}>
                  <div className="screen-label uppercase tracking-[0.3em] text-cream-500 font-bold mb-[0.8cqw]">
                    {t('level')} <span className="text-[color:var(--acc)]">{level && !level.isBreak ? levelNumberOf(target, target.levelIndex) : '—'}</span> / {target.levels.filter((l) => !l.isBreak).length}
                  </div>
                  {st === 'paused' && (
                    <div className="screen-label uppercase tracking-[0.25em] text-loss font-bold mb-[0.8cqw] anim-pulse-soft">{t('timer.paused')}</div>
                  )}
                </div>
                <div className={`font-display num ${remaining === 0 ? 'anim-blink' : remaining != null && remaining <= 30 ? 'text-loss' : 'text-cream-100'}`}>
                  <span className="screen-timer">{remaining != null ? fmtClock(remaining) : '--:--'}</span>
                </div>
                <div className="screen-label uppercase tracking-[0.3em] text-cream-500 font-bold mt-[0.7cqw]">{t('timer.toNextLevel')}</div>
                <div className="w-[70%] h-[0.55cqw] mt-[1.1cqw] rounded-full bg-felt-800 overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${progress * 100}%`, background: remaining != null && remaining <= 30 ? 'var(--color-loss)' : 'var(--acc)' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* blinds */}
        {cfg.showBlinds && (
          <div className="flex-1 flex flex-col gap-[1.2cqw] min-h-0">
            <div className={`flex-[1.3] rounded-xl border border-[rgba(242,193,78,0.2)] bg-gradient-to-b from-[rgba(242,193,78,0.10)] to-transparent flex flex-col items-center justify-center ${flash ? 'anim-level-flash' : ''}`}>
              <div className="screen-label uppercase tracking-[0.3em] text-cream-500 font-bold">{t('blinds')}</div>
              {level && !level.isBreak ? (
                <>
                  <div className="font-display num screen-blinds text-cream-100">
                    {fmtInt(level.sb)} <span className="text-[color:var(--acc)]">/</span> {fmtInt(level.bb)}
                  </div>
                  <div className="screen-sub font-bold mt-[0.4cqw] text-gold-300/90">{level.ante ? `${t('ante')} ${fmtInt(level.ante)}` : t('noAnte')}</div>
                </>
              ) : (
                <div className="font-display screen-blinds text-cream-500">—</div>
              )}
            </div>
            {nxt && st !== 'finished' && (
              <div className="flex-1 rounded-xl border border-line-soft bg-black/20 flex items-center justify-center gap-[2cqw] px-[1cqw]">
                <div className="text-right">
                  <div className="screen-label uppercase tracking-[0.25em] text-cream-700 font-bold">{t('nextLevel')} · {nxt.num}</div>
                  <div className="font-display num text-cream-300" style={{ fontSize: '3.2cqw' }}>
                    {fmtInt(nxt.level.sb)} <span className="text-gold-600">/</span> {fmtInt(nxt.level.bb)}
                  </div>
                </div>
                <div className="screen-sub text-cream-500 font-semibold">{nxt.level.ante ? `${t('ante')} ${fmtInt(nxt.level.ante)}` : t('noAnte')}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* stats */}
      {cfg.showStats && st !== 'scheduled' && (
        <div className="grid grid-cols-4 gap-[1.2cqw]">
          <StatCard label={t('playersLeft')} value={String(stats.active)} sub={`${t('of')} ${stats.registered}`} icon="users" />
          <StatCard label={t('avgStack')} value={fmtChips(stats.avgStack)} sub={`${fmtChips(stats.totalChips)} ${t('inGame')}`} icon="blinds" />
          <StatCard label={t('rebuysLbl')} value={String(stats.rebuys)} sub={`${t('addonsLbl')}: ${stats.addons}`} icon="refresh" />
          <RegStatCard t={t} target={target} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line-soft bg-black/20 px-[1.4cqw] py-[0.9cqw] flex items-center gap-[1.1cqw] overflow-hidden">
      <div className={`shrink-0 w-[3.4cqw] h-[3.4cqw] rounded-lg flex items-center justify-center ${accent ? 'bg-[color:var(--acc)]/15 text-[color:var(--acc)]' : 'bg-felt-750 text-cream-500'}`}>
        <Icon name={icon} size={0} className="w-[1.9cqw] h-[1.9cqw]" />
      </div>
      <div className="min-w-0">
        <div className="screen-label uppercase tracking-[0.2em] text-cream-700 font-bold truncate">{label}</div>
        <div className={`font-display num screen-stat-num truncate ${accent ? 'text-[color:var(--acc)]' : 'text-cream-100'}`}>{value}</div>
        {sub && <div className="screen-label text-cream-500 font-semibold truncate">{sub}</div>}
      </div>
    </div>
  );
}

/** обратный отсчёт до конца регистрации (крупно, на панели таймера до старта) */
function RegPanel({ s, t, target, stats }: { s: AppState; t: TFunc; target: Tournament; stats: ReturnType<typeof liveStats> }) {
  const regRemain = target.registrationClosesAt != null ? Math.max(0, Math.round((target.registrationClosesAt - Date.now()) / 1000)) : null;
  return (
    <div className="flex flex-col items-center gap-[0.9cqw] px-[2cqw] text-center w-full">
      <Icon name="users" size={0} className="w-[4.5cqw] h-[4.5cqw] text-[color:var(--acc)]" />
      <div className="font-display text-[color:var(--acc)]" style={{ fontSize: '4.6cqw' }}>
        {t('status.registration').toUpperCase()}
      </div>
      <div className="screen-sub text-cream-300 num">
        {stats.registered} {t('participants').toLowerCase()} · {fmtDateTime(target.date, s.settings.language)}
      </div>
      {regRemain != null && (
        <>
          <div className="font-display num text-cream-100 mt-[0.6cqw]" style={{ fontSize: '8cqw', lineHeight: 0.85 }}>
            {fmtClock(regRemain)}
          </div>
          <div className="screen-label uppercase tracking-[0.3em] text-cream-500 font-bold">{t('regLeft')}</div>
        </>
      )}
    </div>
  );
}

/** карточка окна регистрации в строке статистики во время игры */
function RegStatCard({ t, target }: { t: TFunc; target: Tournament }) {
  const open = !regClosed(target);
  const remain = target.registrationClosesAt != null ? Math.max(0, Math.round((target.registrationClosesAt - Date.now()) / 1000)) : null;
  if (open && remain != null) {
    return <StatCard label={t('regWindow')} value={fmtClock(remain)} sub={`${t('regUntil')} ${fmtTimeOfDay(target.registrationClosesAt!)}`} icon="timer" accent />;
  }
  if (open) {
    return <StatCard label={t('regWindow')} value="∞" sub={t('window.open')} icon="timer" accent />;
  }
  return <StatCard label={t('regWindow')} value={target.registrationClosesAt ? fmtTimeOfDay(target.registrationClosesAt) : '—'} sub={t('window.closed')} icon="timer" />;
}

/* ================= TABLES ================= */

/* ================= LIVE TOURNAMENT TABLE ================= */

function LiveTableBody({ s, t, target }: { s: AppState; t: TFunc; target: Tournament | null }) {
  const stats = target ? liveStats(target) : { active: 0, avgStack: 0, totalChips: 0, registered: 0, eliminated: 0, rebuys: 0, addons: 0 };
  const entries = target?.entries ?? [];
  const pOf = (pid: string) => s.players.find((x) => x.id === pid);
  const nameOf = (pid: string) => {
    const p = pOf(pid);
    return p ? fullName(p) : '—';
  };
  const nickOf = (pid: string) => pOf(pid)?.nickname ?? '';
  const tableName = (tid: string | null) => (tid ? target?.tables.find((x) => x.id === tid)?.name ?? '' : '');

  const active = entries.filter((e) => !e.eliminated).sort((a, b) => b.stack - a.stack);
  const out = entries.filter((e) => e.eliminated).sort((a, b) => (a.place ?? 999) - (b.place ?? 999));
  const koEnabled = target?.knockoutPointsEnabled ?? false;

  if (!target) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-[1.2cqw] text-cream-500">
        <Icon name="table" size={0} className="w-[6cqw] h-[6cqw] opacity-40" />
        <div className="font-display" style={{ fontSize: '3.4cqw' }}>{t('noActiveTournament')}</div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0 px-[2.4cqw] py-[1.2cqw] gap-[1.2cqw]">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-display text-[color:var(--acc)] leading-none" style={{ fontSize: '4.4cqw' }}>{t('liveTable').toUpperCase()}</div>
          <div className="screen-sub text-cream-500 font-semibold mt-[0.3cqw]">{target.name}</div>
        </div>
        <div className="flex items-center gap-[2.4cqw]">
          <MiniLive label={t('playersLeft')} value={String(stats.active)} />
          <MiniLive label={t('avgStack')} value={fmtChips(stats.avgStack)} />
          {koEnabled && <MiniLive label={t('koPoints')} value={`+${target.knockoutPoints}`} accent />}
        </div>
      </div>

      <div className="flex-1 min-h-0 grid gap-[1.6cqw]" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        {/* в игре — по фишкам */}
        <div className="flex flex-col min-h-0 rounded-xl border border-line-soft bg-black/20 overflow-hidden">
          <div className="grid items-center px-[1.4cqw] py-[0.6cqw] border-b border-line-soft bg-felt-900/60" style={{ gridTemplateColumns: '3cqw 4cqw 1fr 8cqw 9cqw 7cqw' }}>
            <span className="screen-label uppercase tracking-[0.16em] text-cream-700 font-bold">#</span>
            <span />
            <span className="screen-label uppercase tracking-[0.16em] text-cream-700 font-bold">{t('nav.players')} · {t('byStack')}</span>
            <span className="screen-label uppercase tracking-[0.16em] text-cream-700 font-bold">{t('stack')}</span>
            <span className="screen-label uppercase tracking-[0.16em] text-cream-700 font-bold text-right">{t('table')}</span>
            {koEnabled && <span className="screen-label uppercase tracking-[0.16em] text-cream-700 font-bold text-right">{t('koPoints')}</span>}
          </div>
          <ScrollCol>
            {active.map((e, i) => {
              const pp = pOf(e.playerId);
              return (
                <div key={e.playerId} className="grid items-center px-[1.4cqw] py-[0.5cqw] border-b border-line-soft/40 last:border-0" style={{ gridTemplateColumns: '3cqw 4cqw 1fr 8cqw 9cqw 7cqw' }}>
                  <span className="font-display num text-cream-500" style={{ fontSize: '1.9cqw' }}>{i + 1}</span>
                  <span>{pp && <Avatar name={fullName(pp)} color={pp.avatarColor} avatarData={pp.avatarData} size="3cqw" />}</span>
                  <span className="min-w-0">
                    <span className="screen-name font-extrabold text-cream-100 truncate block leading-tight">{nickOf(e.playerId) || nameOf(e.playerId)}</span>
                    <span className="screen-label text-cream-700 font-semibold truncate block">{nameOf(e.playerId)}</span>
                  </span>
                  <span className="font-display num text-cream-100" style={{ fontSize: '2cqw' }}>{fmtChips(e.stack)}</span>
                  <span className="screen-sub num text-cream-500 text-right">{tableName(e.tableId)}{e.seat ? ` · ${e.seat}` : ''}</span>
                  {koEnabled && <span className={`font-display num text-right ${e.livePoints > 0 ? 'text-[color:var(--acc)]' : 'text-cream-700'}`} style={{ fontSize: '1.8cqw' }}>{e.livePoints > 0 ? `+${e.livePoints}` : '—'}</span>}
                </div>
              );
            })}
            {active.length === 0 && <div className="flex-1 flex items-center justify-center screen-sub text-cream-700 py-[2cqw]">{t('empty')}</div>}
          </ScrollCol>
        </div>

        {/* выбыли */}
        <div className="flex flex-col min-h-0 rounded-xl border border-line-soft bg-black/20 overflow-hidden">
          <div className="flex items-center justify-between px-[1.4cqw] py-[0.6cqw] border-b border-line-soft bg-felt-900/60">
            <span className="screen-label uppercase tracking-[0.16em] text-cream-700 font-bold">{t('out')} · {out.length}</span>
            <span className="screen-label uppercase tracking-[0.16em] text-cream-700 font-bold">{t('place')}</span>
          </div>
          <ScrollCol>
            {out.map((e) => {
              const pp = pOf(e.playerId);
              const killer = e.eliminatedBy ? nickOf(e.eliminatedBy) || nameOf(e.eliminatedBy) : null;
              return (
                <div key={e.playerId} className="flex items-center gap-[1cqw] px-[1.4cqw] py-[0.45cqw] border-b border-line-soft/40 last:border-0">
                  <span className={`font-display num w-[3cqw] ${e.place === 1 ? 'text-[color:var(--acc)]' : 'text-cream-500'}`} style={{ fontSize: '2cqw' }}>{e.place}.</span>
                  {pp && <Avatar name={fullName(pp)} color={pp.avatarColor} avatarData={pp.avatarData} size="2.6cqw" />}
                  <span className="min-w-0 flex-1">
                    <span className="screen-name font-bold text-cream-100 truncate block leading-tight">{nickOf(e.playerId) || nameOf(e.playerId)}</span>
                    {killer && <span className="screen-label text-cream-700 font-semibold truncate block">{t('eliminatedByShort')} {killer}</span>}
                  </span>
                  {koEnabled && e.livePoints > 0 && (
                    <span className="font-display num text-[color:var(--acc)]" style={{ fontSize: '1.6cqw' }}>+{e.livePoints}</span>
                  )}
                </div>
              );
            })}
            {out.length === 0 && <div className="flex-1 flex items-center justify-center screen-sub text-cream-700 py-[2cqw]">{t('empty')}</div>}
          </ScrollCol>
        </div>
      </div>
    </div>
  );
}

function MiniLive({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className="screen-label uppercase tracking-[0.2em] text-cream-700 font-bold">{label}</div>
      <div className={`font-display num leading-none ${accent ? 'text-[color:var(--acc)]' : 'text-cream-100'}`} style={{ fontSize: '2.6cqw' }}>{value}</div>
    </div>
  );
}

function ScrollCol({ children }: { children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [anim, setAnim] = useState<{ need: boolean; dur: number }>({ need: false, dur: 30 });
  useLayoutEffect(() => {
    const measure = () => {
      if (!boxRef.current || !innerRef.current) return;
      const over = innerRef.current.scrollHeight - boxRef.current.clientHeight;
      setAnim({ need: over > 8, dur: Math.max(16, over / 13) });
    };
    measure();
    const id = window.setInterval(measure, 1500);
    return () => window.clearInterval(id);
  }, [children]);
  return (
    <div ref={boxRef} className="flex-1 min-h-0 overflow-hidden">
      <div ref={innerRef} className="flex flex-col" style={anim.need ? { animation: `marqueeV ${anim.dur}s linear infinite` } : undefined}>
        {children}
        {anim.need && <div aria-hidden className="flex flex-col">{children}</div>}
      </div>
    </div>
  );
}

function TablesBody({ s, t, target }: { s: AppState; t: TFunc; target: Tournament | null }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [anim, setAnim] = useState<{ need: boolean; dur: number }>({ need: false, dur: 30 });

  const tables = target?.tables ?? [];
  const entries = target?.entries ?? [];
  const seated = (tid: string) => entries.filter((e) => e.tableId === tid && !e.eliminated).sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
  const nameOf = (pid: string) => {
    const p = s.players.find((x) => x.id === pid);
    return p ? fullName(p) : '—';
  };

  useLayoutEffect(() => {
    const measure = () => {
      if (!boxRef.current || !innerRef.current) return;
      const over = innerRef.current.scrollHeight - boxRef.current.clientHeight;
      setAnim({ need: over > 10, dur: Math.max(18, over / 14) });
    };
    measure();
    const id = window.setInterval(measure, 1500);
    return () => window.clearInterval(id);
  }, [entries, tables]);

  if (!target || tables.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-[1.2cqw] text-cream-500">
        <Icon name="table" size={0} className="w-[6cqw] h-[6cqw] opacity-40" />
        <div className="font-display" style={{ fontSize: '3.4cqw' }}>{t('noActiveTournament')}</div>
      </div>
    );
  }

  const nickOf = (pid: string) => s.players.find((x) => x.id === pid)?.nickname ?? '';

  const grid = (prefix: string, hidden = false) => (
    <div className="grid gap-[1.6cqw]" style={{ gridTemplateColumns: `repeat(${tables.length <= 2 ? 2 : 3}, 1fr)` }} aria-hidden={hidden}>
      {tables.map((tb) => {
        const list = seated(tb.id);
        return (
          <div key={prefix + tb.id} className="relative w-full" style={{ aspectRatio: '1.55' }}>
            {/* сукно */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[62%] h-[62%] rounded-[50%] border-2 border-gold-600/60 shadow-[0_0_0_6px_rgba(242,193,78,0.07),0_14px_40px_rgba(0,0,0,0.55)]"
              style={{ background: 'radial-gradient(ellipse at center, rgba(38,84,58,0.6) 0%, #16301f 62%, #0f2417 100%)' }}
            >
              <div className="absolute inset-[6%] rounded-[50%] border border-gold-500/25" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-[0.3cqw] px-[2cqw] text-center">
                <Icon name="spade" size={0} className="w-[2.4cqw] h-[2.4cqw] text-gold-500/70" filled />
                <div className="font-display text-gold-200 leading-none truncate max-w-full" style={{ fontSize: '2.4cqw' }}>{tb.name.toUpperCase()}</div>
                <div className="screen-label num text-cream-500 font-bold">{list.length}/{tb.seats}</div>
              </div>
            </div>
            {/* места по периметру, номер виден всегда */}
            {seatPositions(tb.seats).map((pos, i) => {
              const seat = i + 1;
              const occ = list.find((e) => e.seat === seat);
              const pp = occ ? s.players.find((x) => x.id === occ.playerId) : null;
              return (
                <div key={prefix + seat} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: '13.5cqw' }}>
                  <span
                    className={`flex items-center justify-center rounded-full border font-display num leading-none ${occ ? 'bg-gold-400 text-felt-950 border-gold-300' : 'bg-felt-900/80 text-cream-500 border-line-soft'}`}
                    style={{ width: '2.6cqw', height: '2.6cqw', fontSize: '1.5cqw' }}
                  >
                    {seat}
                  </span>
                  {occ && pp ? (
                    <span className="mt-[0.35cqw] text-center leading-tight w-full">
                      <span className="screen-name font-extrabold text-cream-100 truncate block" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                        {nickOf(occ.playerId) || nameOf(occ.playerId)}
                      </span>
                      {occ.rebuys > 0 && <span className="screen-label text-info font-bold">R{occ.rebuys}</span>}
                    </span>
                  ) : (
                    <span className="mt-[0.35cqw] screen-label text-cream-700 font-semibold">—</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="relative flex-1 min-h-0 p-[1.4cqw]" ref={boxRef}>
      <div ref={innerRef} className="flex flex-col gap-[0.9cqw]" style={anim.need ? { animation: `marqueeV ${anim.dur}s linear infinite` } : undefined}>
        {grid('a')}
        {anim.need && grid('b', true)}
      </div>
    </div>
  );
}

/* ================= LEADERBOARD ================= */

function BoardBody({ s, t }: { s: AppState; t: TFunc }) {
  const seasonId = s.settings.screens.boardSeasonId;
  const rows = leaderboardRows(s.players, s.tournaments, seasonId).slice(0, 10);
  const season = seasonId ? s.seasons.find((x) => x.id === seasonId) : null;
  const pOf = (pid: string) => s.players.find((x) => x.id === pid);
  const nameOf = (pid: string) => {
    const p = pOf(pid);
    return p ? fullName(p) : '—';
  };
  const nickOf = (pid: string) => pOf(pid)?.nickname ?? '';
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  const podiumCard = (r: (typeof rows)[number], place: number) => {
    const p = pOf(r.playerId);
    const tone =
      place === 1
        ? { border: 'border-[color:var(--acc)]/60', bg: 'bg-[color:var(--acc)]/10', text: 'text-[color:var(--acc)]', h: '27cqw', icon: 'crown' }
        : place === 2
          ? { border: 'border-[#c0c8d0]/45', bg: 'bg-[#c0c8d0]/6', text: 'text-[#dbe2e8]', h: '20cqw', icon: 'trophy' }
          : { border: 'border-[#cd7f32]/45', bg: 'bg-[#cd7f32]/6', text: 'text-[#e0a86b]', h: '14.5cqw', icon: 'trophy' };
    return (
      <div key={r.playerId} className="flex flex-col items-stretch self-end w-full">
        <div className={`w-full rounded-t-xl border border-b-0 ${tone.border} ${tone.bg} px-[1cqw] pt-[0.8cqw] pb-[0.8cqw] flex flex-col items-center justify-end gap-[0.25cqw]`} style={{ minHeight: tone.h }}>
          <Icon name={tone.icon} size={0} className={`w-[2.2cqw] h-[2.2cqw] ${tone.text}`} filled />
          {p && <Avatar name={fullName(p)} color={p.avatarColor} avatarData={p.avatarData} size="5.4cqw" />}
          <div className="font-display text-center truncate max-w-full leading-none" style={{ fontSize: '2.1cqw' }}>
            {nickOf(r.playerId) || nameOf(r.playerId)}
          </div>
          <div className="screen-label text-cream-500 font-semibold truncate max-w-full">{nameOf(r.playerId)}</div>
          <div className={`font-display num ${tone.text}`} style={{ fontSize: '2.5cqw', lineHeight: 1 }}>
            {r.points} <span style={{ fontSize: '1.2cqw' }}>{t('pts')}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex-1 flex flex-col min-h-0 px-[2.6cqw] py-[1.2cqw] gap-[1cqw]">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-display text-[color:var(--acc)]" style={{ fontSize: '4.4cqw', lineHeight: 0.95 }}>
            {t('leaderboard').toUpperCase()}
          </div>
          <div className="screen-sub text-cream-500 font-semibold mt-[0.3cqw]">{season ? season.name : t('allTime')}</div>
        </div>
        <div className="flex items-center gap-[0.8cqw]">
          <Icon name="trophy" size={0} className="w-[3.6cqw] h-[3.6cqw] text-[color:var(--acc)]" />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center screen-sub text-cream-500">{t('boardEmpty')}</div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-[38%_1fr] gap-[1.6cqw]">
          {/* подиум топ-3 */}
          <div className="grid grid-cols-3 items-end gap-[0.9cqw] pb-[0.4cqw]">
            {top3[1] && podiumCard(top3[1], 2)}
            {top3[0] && podiumCard(top3[0], 1)}
            {top3[2] && podiumCard(top3[2], 3)}
          </div>

          {/* места 4–10 */}
          <div className="flex flex-col min-h-0 rounded-xl border border-line-soft bg-black/20 overflow-hidden">
            <div className="grid grid-cols-[3.4cqw_4cqw_1fr_7cqw_6cqw_8cqw] items-center px-[1.2cqw] py-[0.5cqw] border-b border-line-soft bg-felt-900/60">
              <span className="screen-label uppercase tracking-[0.18em] text-cream-700 font-bold">#</span>
              <span className="screen-label uppercase tracking-[0.18em] text-cream-700 font-bold">{t('nav.players')}</span>
              <span className="screen-label uppercase tracking-[0.18em] text-cream-700 font-bold text-right">{t('played')}</span>
              <span className="screen-label uppercase tracking-[0.18em] text-cream-700 font-bold text-right">{t('wins')}</span>
              <span className="screen-label uppercase tracking-[0.18em] text-cream-700 font-bold text-right">{t('totalPoints')}</span>
            </div>
            <div className="flex-1 flex flex-col justify-evenly min-h-0">
              {rest.map((r, i) => {
                const p = pOf(r.playerId);
                return (
                <div key={r.playerId} className="grid grid-cols-[3.4cqw_4cqw_1fr_7cqw_6cqw_8cqw] items-center px-[1.2cqw] py-[0.45cqw] border-b border-line-soft/40 last:border-0">
                  <span className="font-display num text-cream-500" style={{ fontSize: '1.9cqw' }}>{i + 4}</span>
                  <span>{p && <Avatar name={fullName(p)} color={p.avatarColor} avatarData={p.avatarData} size="3.1cqw" />}</span>
                  <span className="min-w-0">
                    <span className="screen-name font-bold text-cream-100 truncate block">{nickOf(r.playerId) || nameOf(r.playerId)}</span>
                    <span className="screen-label text-cream-700 font-semibold truncate block">{nameOf(r.playerId)}</span>
                  </span>
                  <span className="screen-sub num text-cream-500 text-right">{r.played}</span>
                  <span className="screen-sub num text-cream-500 text-right">{r.wins}</span>
                  <span className="font-display num text-[color:var(--acc)] text-right" style={{ fontSize: '2.1cqw' }}>{r.points}</span>
                </div>
                );
              })}
              {rest.length === 0 && <div className="flex-1 flex items-center justify-center screen-sub text-cream-700">{t('empty')}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= RESULTS ================= */

function ResultsBody({ s, t, target }: { s: AppState; t: TFunc; target: Tournament | null }) {
  const rows = target?.results ?? [];
  const pOf = (pid: string) => s.players.find((x) => x.id === pid);
  const nameOf = (pid: string) => {
    const p = pOf(pid);
    return p ? fullName(p) : '—';
  };
  const nickOf = (pid: string) => pOf(pid)?.nickname ?? '';
  const before = useMemo(() => rankMap(leaderboardRows(s.players, s.tournaments, null, target?.id)), [s.players, s.tournaments, target]);
  const after = useMemo(() => rankMap(leaderboardRows(s.players, s.tournaments, null)), [s.players, s.tournaments]);

  if (!target || rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-[1.2cqw] text-cream-500">
        <Icon name="trophy" size={0} className="w-[5cqw] h-[5cqw] opacity-40" />
        <div className="screen-sub font-semibold">{t('boardEmpty')}</div>
      </div>
    );
  }

  const top3 = rows.filter((r) => r.place <= 3).sort((a, b) => a.place - b.place);
  const rest = rows.filter((r) => r.place > 3).sort((a, b) => a.place - b.place);

  const podium = (r: (typeof rows)[number], height: string, icon: string, label: string, tone: string) => {
    const p = pOf(r.playerId);
    return (
    <div className="flex flex-col items-stretch self-end w-full">
      <div className={`w-full rounded-t-xl border border-b-0 px-[1.4cqw] pt-[0.8cqw] pb-[0.7cqw] flex flex-col items-center justify-end gap-[0.25cqw] ${tone}`} style={{ minHeight: height }}>
        <Icon name={icon} size={0} className="w-[2.4cqw] h-[2.4cqw]" filled />
        {p && <Avatar name={fullName(p)} color={p.avatarColor} avatarData={p.avatarData} size="5.6cqw" />}
        <div className="screen-label uppercase tracking-[0.2em] font-bold opacity-80">{label}</div>
        <div className="font-display text-center truncate max-w-full leading-none" style={{ fontSize: '2.1cqw' }}>
          {nickOf(r.playerId) || nameOf(r.playerId)}
        </div>
        <div className="screen-label text-cream-500 font-semibold truncate max-w-full">{nameOf(r.playerId)}</div>
        <div className="font-display num" style={{ fontSize: '2.7cqw', lineHeight: 1 }}>+{r.points}</div>
        <RankMove before={before.get(r.playerId)} after={after.get(r.playerId)} size="1.4cqw" />
      </div>
    </div>
    );
  };

  return (
    <div className="relative flex-1 flex flex-col min-h-0 px-[3cqw] py-[1.2cqw] gap-[1cqw]">
      <div className="text-center">
        <div className="font-display text-[color:var(--acc)]" style={{ fontSize: '4.4cqw', lineHeight: 0.95 }}>
          {t('resultsTitle').toUpperCase()}
        </div>
        <div className="screen-sub text-cream-500 font-semibold mt-[0.3cqw]">
          {target.name} · {fmtDate(target.date, s.settings.language)}
        </div>
      </div>

      <div className="flex items-end justify-center gap-[1.4cqw] px-[6cqw]">
        {top3.find((r) => r.place === 2) && podium(top3.find((r) => r.place === 2)!, '17cqw', 'hand', t('runnerUp'), 'bg-[#c0c8d0]/10 border-[#c0c8d0]/40 text-[#dbe2e8]')}
        {top3.find((r) => r.place === 1) && podium(top3.find((r) => r.place === 1)!, '24cqw', 'crown', t('champion'), 'bg-[color:var(--acc)]/12 border-[color:var(--acc)]/60 text-[color:var(--acc)]')}
        {top3.find((r) => r.place === 3) && podium(top3.find((r) => r.place === 3)!, '12.5cqw', 'trophy', t('thirdPlace'), 'bg-[#cd7f32]/10 border-[#cd7f32]/45 text-[#e0a86b]')}
      </div>

      {rest.length > 0 && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col items-center gap-[0.45cqw]">
          {rest.map((r) => {
            const p = pOf(r.playerId);
            return (
            <div key={r.playerId} className="w-[62%] flex items-center gap-[1cqw] rounded-lg border border-line-soft bg-felt-900/60 px-[1.4cqw] py-[0.35cqw]">
              <span className="font-display num text-gold-600 w-[2.6cqw]" style={{ fontSize: '1.9cqw' }}>{r.place}.</span>
              {p && <Avatar name={fullName(p)} color={p.avatarColor} avatarData={p.avatarData} size="2.9cqw" />}
              <span className="flex-1 min-w-0">
                <span className="screen-name font-bold truncate block leading-tight">{nickOf(r.playerId) || nameOf(r.playerId)}</span>
                <span className="screen-label text-cream-700 font-semibold truncate block">{nameOf(r.playerId)}</span>
              </span>
              <RankMove before={before.get(r.playerId)} after={after.get(r.playerId)} size="1.3cqw" />
              <span className="screen-sub num text-gold-300 font-bold">+{r.points} {t('pts')}</span>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RankMove({ before, after, size }: { before?: number; after?: number; size: string }) {
  if (!before || !after) {
    return after ? (
      <span className="num text-win font-bold" style={{ fontSize: size }}>new · {after}</span>
    ) : (
      <span style={{ fontSize: size }}>—</span>
    );
  }
  const diff = before - after;
  if (diff === 0) return <span className="num text-cream-500" style={{ fontSize: size }}>{after}</span>;
  return (
    <span className={`num font-bold flex items-center gap-[0.3cqw] ${diff > 0 ? 'text-win' : 'text-loss'}`} style={{ fontSize: size }}>
      {before} → {after}
      <Icon name={diff > 0 ? 'up' : 'down'} size={0} className="w-[1.1cqw] h-[1.1cqw]" />
    </span>
  );
}

/* ================= TICKER ================= */

function Ticker({ s }: { s: AppState }) {
  const items = s.ticker.slice(0, 6);
  if (items.length === 0) return null;
  const text = items.map((i) => i.text).join('   •   ');
  return (
    <div className="relative border-t border-[rgba(242,193,78,0.16)] bg-black/40 overflow-hidden">
      <div className="flex whitespace-nowrap anim-marquee py-[0.55cqw]">
        {[0, 1].map((k) => (
          <span key={k} className="screen-sub font-semibold text-gold-300/90 pr-[4cqw]">
            ♠ {text} ♠ {text}
          </span>
        ))}
      </div>
    </div>
  );
}
