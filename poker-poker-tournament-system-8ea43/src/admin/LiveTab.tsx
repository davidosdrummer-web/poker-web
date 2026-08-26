import { useEffect, useMemo, useReducer, useState } from 'react';
import type { Tournament } from '../lib/types';
import { actions, can, getActiveTournament, rebuyClosed, regClosed, remainingSeconds, useApp } from '../lib/store';
import { makeT } from '../lib/i18n';
import { entryPoints, fmtChips, fmtClock, fmtInt, fmtTimeOfDay, fullName, liveStats } from '../lib/utils';
import { playSfx } from '../lib/sfx';
import { Badge, Btn, EmptyState, Field, Icon, KeyCap, Modal, toast } from '../components/ui';

export function LiveTab({ onOpenEditor }: { onOpenEditor: (tournamentId: string, section: string) => void }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [breakMin, setBreakMin] = useState(10);
  const [elimOpen, setElimOpen] = useState(false);
  const [rebuyOpen, setRebuyOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);

  const tor = getActiveTournament(s);

  useEffect(() => {
    const id = window.setInterval(force, 300);
    return () => window.clearInterval(id);
  }, []);

  /* E — quick eliminate while on this tab */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.key.toLowerCase() === 'e' && !e.metaKey && !e.ctrlKey && tor && can('live')) {
        e.preventDefault();
        setElimOpen(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [tor]);

  if (!tor) {
    return (
      <div className="card anim-rise p-10 max-w-2xl mx-auto text-center">
        <Icon name="spade" size={44} className="mx-auto text-gold-400 opacity-60" filled />
        <h2 className="font-display text-3xl text-cream-100 mt-4">{t('noActiveTournament')}</h2>
        <p className="text-sm text-cream-500 mt-2">{t('pickTournament')}</p>
        <Btn variant="gold" size="lg" icon="next" className="mt-5" onClick={() => onOpenEditor('', '')}>
          {t('openTournaments')}
        </Btn>
      </div>
    );
  }

  return (
    <div className="anim-rise">
      <MissionControl tor={tor} breakMin={breakMin} setBreakMin={setBreakMin} onElim={() => setElimOpen(true)} onRebuy={() => setRebuyOpen(true)} onBonus={() => setBonusOpen(true)} onFinish={() => setFinishOpen(true)} onOpenEditor={onOpenEditor} />
      {elimOpen && <EliminateModal tor={tor} onClose={() => setElimOpen(false)} />}
      {rebuyOpen && <RebuyModal tor={tor} onClose={() => setRebuyOpen(false)} />}
      {bonusOpen && <BonusModal tor={tor} onClose={() => setBonusOpen(false)} />}
      {finishOpen && <FinishModal tor={tor} onClose={() => setFinishOpen(false)} />}
    </div>
  );
}

function MissionControl({ tor, breakMin, setBreakMin, onElim, onRebuy, onBonus, onFinish, onOpenEditor }: {
  tor: Tournament;
  breakMin: number;
  setBreakMin: (n: number) => void;
  onElim: () => void;
  onRebuy: () => void;
  onBonus: () => void;
  onFinish: () => void;
  onOpenEditor: (id: string, section: string) => void;
}) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const remaining = remainingSeconds(s, tor);
  const stats = useMemo(() => liveStats(tor), [tor]);
  const allowed = can('live');
  const st = tor.status;
  const level = tor.levels[tor.levelIndex];
  const levelNum = tor.levels.slice(0, tor.levelIndex + 1).filter((l) => !l.isBreak).length;
  const totalLevels = tor.levels.filter((l) => !l.isBreak).length;
  const isBreak = st === 'break';
  const preStart = st === 'scheduled' || st === 'registration';

  const meta: Record<string, { label: string; tone: 'gold' | 'green' | 'red' | 'info' | 'neutral' }> = {
    scheduled: { label: t('status.scheduled'), tone: 'neutral' },
    registration: { label: t('status.registration'), tone: 'info' },
    running: { label: t('status.running'), tone: 'green' },
    paused: { label: t('status.paused'), tone: 'red' },
    break: { label: t('status.break'), tone: 'gold' },
    finished: { label: t('status.finished'), tone: 'neutral' },
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 xl:col-span-8 card p-5 relative overflow-hidden">
        <div className="absolute inset-0 suit-pattern pointer-events-none" />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="min-w-[230px]">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge tone={meta[st].tone}>
                {st === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-win anim-pulse-soft" />}
                {meta[st].label}
              </Badge>
              {level && !level.isBreak && !preStart && st !== 'finished' && (
                <span className="text-xs text-cream-500 font-semibold num">{t('level')} {levelNum}/{totalLevels}</span>
              )}
            </div>
            <div className={`font-display num leading-none ${remaining === 0 && (st === 'running' || isBreak) ? 'anim-blink' : remaining != null && remaining <= 30 && st === 'running' ? 'text-loss' : 'text-cream-100'}`} style={{ fontSize: '5rem' }}>
              {preStart || st === 'finished' ? '--:--' : remaining != null ? fmtClock(remaining) : '--:--'}
            </div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-cream-500 font-bold mt-2">
              {isBreak ? t('timer.toBreakEnd') : st === 'paused' ? t('timer.paused') : preStart ? t('timer.notStarted') : st === 'finished' ? t('timer.finished') : t('timer.toNextLevel')}
            </div>
            {level && !preStart && (
              <div className="mt-3 flex items-center gap-3">
                {level.isBreak ? (
                  <span className="font-display text-2xl text-gold-300">{t('break')} · {level.duration} {t('min')}</span>
                ) : (
                  <>
                    <span className="font-display text-3xl text-cream-100 num">{fmtInt(level.sb)} / {fmtInt(level.bb)}</span>
                    <span className="text-xs font-bold text-gold-300">{level.ante ? `${t('ante')} ${fmtInt(level.ante)}` : t('noAnte')}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-[320px]">
            <div className="grid grid-cols-2 gap-2.5">
              {preStart && (
                <Btn variant="gold" size="lg" icon="play" className="col-span-2 !py-4 !text-lg" disabled={!allowed || tor.entries.length < 2} onClick={() => { actions.start(tor.id); playSfx('start', s.settings.sfx); toast(t('status.running')); }}>
                  {t('startTournament')}
                </Btn>
              )}
              {st === 'paused' && (
                <Btn variant="gold" size="lg" icon="play" className="col-span-2 !py-4 !text-lg" disabled={!allowed} onClick={() => actions.resume(tor.id)}>
                  {t('resume')} <KeyCap>Space</KeyCap>
                </Btn>
              )}
              {(st === 'running' || isBreak) && (
                <Btn variant="danger" size="lg" icon="pause" className="col-span-2 !py-4 !text-lg" disabled={!allowed} onClick={() => actions.pause(tor.id)}>
                  {t('pause')} <KeyCap>Space</KeyCap>
                </Btn>
              )}
              <Btn icon="next" size="lg" disabled={!allowed || preStart || st === 'finished'} onClick={() => { actions.nextLevel(tor.id); playSfx('level', s.settings.sfx); }}>
                {t('nextLevelBtn')} <KeyCap>N</KeyCap>
              </Btn>
              {isBreak ? (
                <Btn icon="play" size="lg" variant="green" disabled={!allowed} onClick={() => { actions.endBreak(tor.id); playSfx('level', s.settings.sfx); }}>
                  {t('endBreak')} <KeyCap>B</KeyCap>
                </Btn>
              ) : (
                <Btn icon="coffee" size="lg" disabled={!allowed || st !== 'running'} onClick={() => { actions.breakNow(tor.id, breakMin); playSfx('break', s.settings.sfx); }}>
                  {t('breakNow')} · {breakMin} {t('min')} <KeyCap>B</KeyCap>
                </Btn>
              )}
              <div className="col-span-2 grid grid-cols-4 gap-2.5">
                <Btn size="sm" disabled={!allowed || preStart || st === 'finished'} onClick={() => actions.addTime(tor.id, -60)}>{t('subMinute')}</Btn>
                <Btn size="sm" disabled={!allowed || preStart || st === 'finished'} onClick={() => actions.addTime(tor.id, 60)}>{t('addMinute')}</Btn>
                <Btn size="sm" icon="refresh" disabled={!allowed || preStart || st === 'finished'} onClick={() => actions.resetTimer(tor.id)}>{t('resetTimer')}</Btn>
                <div className="flex items-center justify-end">
                  <input type="number" min={1} max={60} value={breakMin} onChange={(e) => setBreakMin(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} className="inp !w-16 !py-1 !text-center num" />
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn variant="dark" icon="users" disabled={!allowed || stats.active === 0 || st === 'finished'} onClick={onElim}>
                {t('quickEliminate')} <KeyCap>E</KeyCap>
              </Btn>
              <Btn variant="dark" icon="refresh" disabled={!allowed || stats.active === 0 || st === 'finished' || preStart} onClick={onRebuy}>
                {t('rebuy')} / {t('addon')} / {t('reentry')}
              </Btn>
              <Btn variant="dark" icon="plus" disabled={!allowed || stats.active === 0 || st === 'finished' || preStart} onClick={onBonus}>
                {t('bonus')}
              </Btn>
              <Btn variant="danger" icon="flag" disabled={!allowed || st === 'finished' || preStart} onClick={onFinish}>
                {t('finalize')}
              </Btn>
              <Btn variant="ghost" icon="table" onClick={() => onOpenEditor(tor.id, 'tables')}>
                {t('seatedQuick')}
              </Btn>
            </div>
          </div>
        </div>
        {!preStart && st !== 'finished' && <WindowsStrip tor={tor} />}
      </div>

      <div className="col-span-12 xl:col-span-4 grid grid-cols-2 gap-3 content-start">
        <MiniStat label={t('playersLeft')} value={String(stats.active)} sub={`${t('of')} ${stats.registered}`} icon="users" />
        <MiniStat label={t('avgStack')} value={fmtChips(stats.avgStack)} sub={`${fmtChips(stats.totalChips)} ${t('inGame')}`} icon="blinds" />
        <MiniStat label={t('rebuysLbl')} value={String(stats.rebuys)} sub={`${t('addonsLbl')}: ${stats.addons}`} icon="refresh" />
        <MiniStat label={t('registered')} value={String(stats.registered)} sub={preStart ? t('status.registration') : `${stats.eliminated} ${t('eliminated').toLowerCase()}`} icon="hand" accent />
      </div>

      {preStart && <RegisteredPanel tor={tor} onOpenEditor={onOpenEditor} />}
      {!preStart && st !== 'finished' && tor.entries.some((e) => e.eliminated) && <ComebackPanel tor={tor} />}

      <div className="col-span-12 card p-5">
        <h3 className="font-display text-xl text-gold-300 mb-3 flex items-center gap-2"><Icon name="timer" size={18} /> {t('structure')}</h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tor.levels.map((l, i) => {
            const num = tor.levels.slice(0, i + 1).filter((x) => !x.isBreak).length;
            const isCur = i === tor.levelIndex && !preStart;
            const past = i < tor.levelIndex && !preStart;
            return (
              <div key={l.id} className={`shrink-0 rounded-lg border px-3 py-2 text-center min-w-[92px] transition-colors ${isCur ? 'border-gold-400/60 bg-gold-400/10' : past ? 'border-line-soft opacity-40' : 'border-line-soft bg-felt-900/60'}`}>
                <div className="text-[10px] uppercase tracking-widest font-bold text-cream-500">{l.isBreak ? t('break') : `${num}`}</div>
                <div className={`font-display text-lg num ${isCur ? 'text-gold-300' : 'text-cream-100'}`}>{l.isBreak ? `${l.duration}′` : `${fmtChips(l.sb)}/${fmtChips(l.bb)}`}</div>
                <div className="text-[10px] text-cream-700 num">{l.duration} {t('min')}{!l.isBreak && l.ante ? ` · A${fmtChips(l.ante)}` : ''}</div>
              </div>
            );
          })}
          {tor.levels.length === 0 && <EmptyState text={t('empty')} />}
        </div>
      </div>
    </div>
  );
}

function RegisteredPanel({ tor, onOpenEditor }: { tor: Tournament; onOpenEditor: (id: string, section: string) => void }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const allowed = can('live');
  const nameOf = (pid: string) => {
    const p = s.players.find((x) => x.id === pid);
    return p ? fullName(p) : '—';
  };
  return (
    <div className="col-span-12 card p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-display text-xl text-gold-300 flex items-center gap-2"><Icon name="users" size={18} /> {t('participants')} · {tor.entries.length}</h3>
        <Btn size="sm" icon="edit" onClick={() => onOpenEditor(tor.id, 'registration')}>{t('registration')}</Btn>
      </div>
      {tor.entries.length === 0 ? (
        <EmptyState icon="users" text={t('empty')} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {tor.entries.map((e) => (
            <div key={e.playerId} className="flex items-center gap-2 rounded-lg border border-line-soft bg-felt-900/60 pl-3 pr-1.5 py-1.5">
              <span className="text-sm font-semibold">{nameOf(e.playerId)}</span>
              {allowed && (
                <button className="p-1 rounded text-cream-700 hover:text-loss hover:bg-loss/10 transition-colors" onClick={() => actions.toggleEntry(tor.id, e.playerId)} title={t('remove')}>
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {tor.entries.length > 0 && tor.entries.length < 2 && (
        <div className="mt-3 text-xs text-loss font-semibold flex items-center gap-2"><Icon name="info" size={13} /> {t('startRequiresPlayers')}</div>
      )}
    </div>
  );
}

function MiniStat({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: string; accent?: boolean }) {
  return (
    <div className="card p-3.5 flex items-center gap-3 min-w-0">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent ? 'bg-gold-400/15 text-gold-300' : 'bg-felt-750 text-cream-500'}`}>
        <Icon name={icon} size={19} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-cream-500 truncate">{label}</div>
        <div className={`font-display text-2xl num leading-tight truncate ${accent ? 'text-gold-300' : 'text-cream-100'}`}>{value}</div>
        {sub && <div className="text-[11px] text-cream-500 font-semibold truncate num">{sub}</div>}
      </div>
    </div>
  );
}

/* ---------------- modals ---------------- */

export function EliminateModal({ tor, onClose }: { tor: Tournament; onClose: () => void }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const active = tor.entries.filter((e) => !e.eliminated);
  const [pid, setPid] = useState(active[0]?.playerId ?? '');
  const [byId, setById] = useState<string | null>(null);
  const nameOf = (id: string | null) => {
    if (!id) return '';
    const p = s.players.find((x) => x.id === id);
    return p ? fullName(p) : '—';
  };
  return (
    <Modal title={t('eliminateTitle')} onClose={onClose} footer={
      <>
        <Btn variant="ghost" onClick={onClose}>{t('cancel')}</Btn>
        <Btn variant="danger" icon="hand" disabled={!pid} onClick={() => { actions.eliminate(tor.id, pid, byId); playSfx('eliminate', s.settings.sfx); toast(`${nameOf(pid)} — ${t('eliminated').toLowerCase()}`); onClose(); }}>
          {t('eliminate')}
        </Btn>
      </>
    }>
      <p className="text-xs text-cream-500 mb-3">{t('eliminateHint')}</p>
      <div className="grid gap-3">
        <Field label={t('choosePlayer')}>
          <select className="inp" value={pid} onChange={(e) => { setPid(e.target.value); setById(null); }}>
            {active.map((e) => (
              <option key={e.playerId} value={e.playerId}>{nameOf(e.playerId)} · {fmtChips(e.stack)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('eliminatedBy')}>
          <select className="inp" value={byId ?? ''} onChange={(e) => setById(e.target.value || null)}>
            <option value="">{t('nobody')}</option>
            {active.filter((e) => e.playerId !== pid).map((e) => (
              <option key={e.playerId} value={e.playerId}>{nameOf(e.playerId)}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

export function RebuyModal({ tor, onClose }: { tor: Tournament; onClose: () => void }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const all = tor.entries;
  const active = all.filter((e) => !e.eliminated);
  const [pid, setPid] = useState(active[0]?.playerId ?? all[0]?.playerId ?? '');
  const entry = tor.entries.find((e) => e.playerId === pid);
  const closed = rebuyClosed(tor);
  const nameOf = (id: string) => {
    const p = s.players.find((x) => x.id === id);
    return p ? fullName(p) : '—';
  };
  return (
    <Modal title={t('rebuyAdd')} onClose={onClose} footer={<Btn variant="ghost" onClick={onClose}>{t('close')}</Btn>}>
      <p className="text-xs text-cream-500 mb-3">{t('rebuyHint')}</p>
      {closed ? (
        <div className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2.5 text-xs text-loss font-semibold flex items-center gap-2 mb-3">
          <Icon name="info" size={14} /> {t('rebuyClosed')}{tor.rebuyClosesAt ? ` · ${fmtTimeOfDay(tor.rebuyClosesAt)}` : ''}
        </div>
      ) : (
        <div className="rounded-lg border border-win/25 bg-win/8 px-3 py-2.5 text-xs text-win font-semibold flex items-center gap-2 mb-3">
          <Icon name="refresh" size={14} /> {t('rebuyWindow')}: {t('window.left')} {tor.rebuyClosesAt ? fmtClock(Math.max(0, Math.round((tor.rebuyClosesAt - Date.now()) / 1000))) : '∞'}
        </div>
      )}
      <Field label={t('choosePlayer')}>
        <select className="inp" value={pid} onChange={(e) => setPid(e.target.value)}>
          {all.map((e) => (
            <option key={e.playerId} value={e.playerId}>
              {nameOf(e.playerId)}{e.eliminated ? ` — ${t('eliminated').toLowerCase()} (${t('comeback')})` : ''}
            </option>
          ))}
        </select>
      </Field>
      {entry && (
        <div className="mt-4 rounded-lg border border-line-soft bg-felt-900/60 p-3.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-cream-500 font-semibold">{t('stack')}</span>
            <span className="font-display text-2xl text-gold-300 num">{fmtChips(entry.stack)}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5 text-cream-500">
            <span>{t('rebuysLbl')}: <b className="text-cream-300 num">{entry.rebuys}</b> · {t('addonsLbl')}: <b className="text-cream-300 num">{entry.addons}</b> · {t('entriesShort')}: <b className="text-cream-300 num">{entry.entries}</b></span>
            <span>+{fmtChips(tor.rebuyChips)} / {t('rebuy').toLowerCase()}</span>
          </div>
          {entry.eliminated && <div className="mt-2 text-[11px] text-gold-300 font-semibold flex items-center gap-1.5"><Icon name="info" size={12} /> {t('rebuyWindowHint')}</div>}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <button disabled={closed} onClick={() => { actions.rebuyStack(tor.id, pid, 'rebuy'); playSfx('rebuy', s.settings.sfx); toast(`${t('rebuy')} ${entry.rebuys + 1} · +${fmtChips(tor.rebuyChips)}${entry.eliminated ? ` · ${t('comeback')}` : ''}`); }} className="rounded-lg border border-gold-400/40 bg-gold-400/12 hover:bg-gold-400/20 disabled:opacity-35 disabled:pointer-events-none px-2 py-2 text-center transition-colors">
              <span className="block text-sm font-bold text-gold-300">{t('rebuy')} {entry.rebuys + 1}</span>
              <span className="block text-[10px] num text-cream-500 font-semibold">+{fmtChips(tor.rebuyChips)}</span>
            </button>
            <button disabled={closed} onClick={() => { actions.reentry(tor.id, pid); playSfx('reentry', s.settings.sfx); toast(`${t('reentry')} · +${fmtChips(tor.reentryChips)} · ${t('comeback')}`); }} className="rounded-lg border border-win/35 bg-win/10 hover:bg-win/20 disabled:opacity-35 disabled:pointer-events-none px-2 py-2 text-center transition-colors" title={t('reentryDesc')}>
              <span className="block text-sm font-bold text-win">{t('reentry')}</span>
              <span className="block text-[10px] num text-cream-500 font-semibold">+{fmtChips(tor.reentryChips)}</span>
            </button>
            <button disabled={closed} onClick={() => { actions.rebuyStack(tor.id, pid, 'addon'); playSfx('addon', s.settings.sfx); toast(`${t('addon')} ${entry.addons + 1} · +${fmtChips(tor.addonChips)}${entry.eliminated ? ` · ${t('comeback')}` : ''}`); }} className="rounded-lg border border-line bg-felt-800 hover:bg-felt-750 disabled:opacity-35 disabled:pointer-events-none px-2 py-2 text-center transition-colors">
              <span className="block text-sm font-bold text-cream-100">{t('addon')} {entry.addons + 1}</span>
              <span className="block text-[10px] num text-cream-500 font-semibold">+{fmtChips(tor.addonChips)}</span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- windows strip / comeback / bonus ---------------- */

function WindowsStrip({ tor }: { tor: Tournament }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const now = Date.now();
  const regOpen = !regClosed(tor);
  const rebOpen = !rebuyClosed(tor);
  const chip = (open: boolean, label: string, until: number | null, extra?: string) => (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${open ? 'border-win/25 bg-win/8' : 'border-line-soft bg-felt-900/60'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-win anim-pulse-soft' : 'bg-cream-700'}`} />
      <span className="text-xs font-bold text-cream-300">{label}</span>
      {open ? (
        <span className="text-xs num text-win font-semibold">
          {until ? `${t('window.left')} ${fmtClock(Math.max(0, Math.round((until - now) / 1000)))} · ${t('regCloses').split(' ')[0]}. ${fmtTimeOfDay(until)}` : '∞'}
          {extra ? ` · ${extra}` : ''}
        </span>
      ) : (
        <span className="text-xs text-cream-700 font-semibold num">
          {t('window.closed')}{until ? ` · ${fmtTimeOfDay(until)}` : ''}
        </span>
      )}
    </div>
  );
  return (
    <div className="relative mt-4 pt-4 border-t border-line-soft flex flex-wrap gap-2.5">
      {chip(regOpen, t('regWindow'), tor.registrationClosesAt, regOpen && tor.status === 'registration' ? undefined : t('lateReg'))}
      {chip(rebOpen, t('rebuyWindow'), tor.rebuyClosesAt)}
    </div>
  );
}

function ComebackPanel({ tor }: { tor: Tournament }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const allowed = can('live');
  const closed = rebuyClosed(tor);
  const out = tor.entries.filter((e) => e.eliminated).sort((a, b) => (b.place ?? 0) - (a.place ?? 0));
  const nameOf = (id: string) => {
    const p = s.players.find((x) => x.id === id);
    return p ? fullName(p) : '—';
  };
  return (
    <div className="col-span-12 card p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-display text-xl text-gold-300 flex items-center gap-2"><Icon name="refresh" size={18} /> {t('comeback')} · {out.length}</h3>
        <Badge tone={closed ? 'neutral' : 'green'}>{closed ? t('rebuyClosed') : `${t('rebuyWindow')} · ${t('window.open')}`}</Badge>
      </div>
      <p className="text-[11px] text-cream-500 mb-3 flex items-center gap-2"><Icon name="info" size={13} /> {t('rebuyWindowHint')}</p>
      <div className="flex flex-col gap-1.5">
        {out.map((e) => (
          <div key={e.playerId} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-felt-900/50 px-3 py-2">
            <span className={`font-display text-lg w-9 num ${e.place === 2 ? 'text-[#dbe2e8]' : e.place === 3 ? 'text-[#e0a86b]' : 'text-cream-500'}`}>{e.place}.</span>
            <span className="flex-1 text-sm font-semibold truncate">{nameOf(e.playerId)}</span>
            {e.eliminatedBy && <span className="text-[11px] text-cream-700 truncate max-w-[140px]">← {nameOf(e.eliminatedBy)}</span>}
            <span className="text-[11px] num text-cream-500">{t('rebuysLbl')}: {e.rebuys} · {t('entriesShort')}: {e.entries}</span>
            <div className="flex gap-1.5">
              <Btn size="sm" variant="gold" disabled={!allowed || closed} title={e.lastSeat ? `${t('table')} ${tor.tables.find((x) => x.id === e.lastTableId)?.name ?? ''} · ${t('seat')} ${e.lastSeat}` : undefined} onClick={() => { actions.rebuyStack(tor.id, e.playerId, 'rebuy'); playSfx('rebuy', s.settings.sfx); toast(`${nameOf(e.playerId)} · ${t('comeback')}`); }}>
                {t('rebuy')}
              </Btn>
              <Btn size="sm" variant="green" disabled={!allowed || closed} onClick={() => { actions.reentry(tor.id, e.playerId); playSfx('reentry', s.settings.sfx); toast(`${nameOf(e.playerId)} · ${t('reentry')}`); }}>
                {t('reentry')}
              </Btn>
              <Btn size="sm" variant="dark" icon="dice" disabled={!allowed || closed} title={t('rebuyRandom')} onClick={() => { actions.rebuyStack(tor.id, e.playerId, 'rebuy'); actions.seatRandom(tor.id, e.playerId); playSfx('rebuy', s.settings.sfx); toast(`${nameOf(e.playerId)} · ${t('seatRandomOne')}`); }}>
                <span className="sr-only">{t('rebuyRandom')}</span>
              </Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BonusModal({ tor, onClose }: { tor: Tournament; onClose: () => void }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const active = tor.entries.filter((e) => !e.eliminated);
  const [pid, setPid] = useState(active[0]?.playerId ?? '');
  const [selId, setSelId] = useState<string>(tor.bonuses[0]?.id ?? 'custom');
  const [chips, setChips] = useState(tor.bonuses[0]?.chips ?? 1000);
  const [custom, setCustom] = useState('');
  const entry = tor.entries.find((e) => e.playerId === pid);
  const nameOf = (id: string) => {
    const p = s.players.find((x) => x.id === id);
    return p ? fullName(p) : '—';
  };
  const selBonus = tor.bonuses.find((b) => b.id === selId);
  const finalReason = selId === 'custom' ? (custom.trim() || t('reason.other')) : (selBonus?.name.trim() || t('reason.other'));
  return (
    <Modal title={t('bonusTitle')} onClose={onClose} footer={
      <>
        <Btn variant="ghost" onClick={onClose}>{t('cancel')}</Btn>
        <Btn variant="gold" icon="plus" disabled={!pid || chips <= 0} onClick={() => { actions.addBonus(tor.id, pid, chips, finalReason); toast(`${nameOf(pid)}: +${fmtChips(chips)} · ${finalReason}`); onClose(); }}>
          {t('bonusAdded').split(' ')[0]} +{fmtChips(chips)}
        </Btn>
      </>
    }>
      <p className="text-xs text-cream-500 mb-3">{t('bonusHint')}</p>
      <div className="grid gap-3">
        <Field label={t('choosePlayer')}>
          <select className="inp" value={pid} onChange={(e) => setPid(e.target.value)}>
            {active.map((e) => (
              <option key={e.playerId} value={e.playerId}>{nameOf(e.playerId)} · {fmtChips(e.stack)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('bonusReason')}>
          <div className="flex gap-1.5 flex-wrap">
            {tor.bonuses.map((b) => (
              <button
                key={b.id}
                onClick={() => { setSelId(b.id); setChips(b.chips); }}
                className={`px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors flex items-center gap-2 ${selId === b.id ? 'bg-felt-700 text-gold-300 border-gold-400/50' : 'border-line-soft text-cream-300 hover:border-felt-600'}`}
              >
                <span>{b.name || t('bonusName')}</span>
                <span className="num text-gold-400 font-bold">+{fmtChips(b.chips)}</span>
              </button>
            ))}
            <button
              onClick={() => setSelId('custom')}
              className={`px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${selId === 'custom' ? 'bg-felt-700 text-gold-300 border-gold-400/50' : 'border-line-soft text-cream-300 hover:border-felt-600'}`}
            >
              {t('reason.other')}
            </button>
          </div>
          {selId === 'custom' && (
            <input className="inp mt-2" placeholder={t('bonusCustom')} value={custom} onChange={(e) => setCustom(e.target.value)} autoFocus />
          )}
        </Field>
        <Field label={t('bonusChips')}>
          <div className="flex items-center gap-2">
            <input className="inp !w-28 num" type="number" value={chips} onChange={(e) => setChips(Math.max(0, Number(e.target.value) || 0))} />
            <span className="text-[11px] text-cream-500">{selBonus ? `= ${selBonus.name}` : t('bonusCustom')}</span>
          </div>
        </Field>
        {entry && (
          <div className="rounded-lg border border-line-soft bg-felt-900/60 px-3 py-2.5 flex items-center justify-between">
            <span className="text-xs text-cream-500 font-semibold">{nameOf(pid)}: {fmtChips(entry.stack)} →</span>
            <span className="font-display text-xl text-win num">{fmtChips(entry.stack + chips)}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function FinishModal({ tor, onClose }: { tor: Tournament; onClose: () => void }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [order, setOrder] = useState<string[]>(() => {
    const active = tor.entries.filter((e) => !e.eliminated).sort((a, b) => b.stack - a.stack).map((e) => e.playerId);
    const out = tor.entries.filter((e) => e.eliminated).sort((a, b) => (b.place ?? 0) - (a.place ?? 0)).map((e) => e.playerId);
    return [...active, ...out];
  });
  const nameOf = (id: string) => {
    const p = s.players.find((x) => x.id === id);
    return p ? fullName(p) : '—';
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  const entryOf = (id: string) => tor.entries.find((e) => e.playerId === id);
  return (
    <Modal wide title={t('confirmFinish')} onClose={onClose} footer={
      <>
        <Btn variant="ghost" onClick={onClose}>{t('cancel')}</Btn>
        <Btn variant="gold" icon="trophy" onClick={() => { actions.finalize(tor.id, order); onClose(); toast(t('autoFinishNote')); }}>
          {t('finalize')}
        </Btn>
      </>
    }>
      <p className="text-sm text-cream-500 mb-3">{t('finishHint')}</p>
      <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto pr-1">
        {order.map((id, i) => {
          const e = entryOf(id);
          const pts = e ? entryPoints(tor, i + 1, e.rebuys, e.addons) : 0;
          return (
            <div key={id} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-felt-900/60 px-3 py-2">
              <span className={`font-display text-xl w-8 num ${i === 0 ? 'text-gold-300' : i === 1 ? 'text-[#dbe2e8]' : i === 2 ? 'text-[#e0a86b]' : 'text-cream-500'}`}>{i + 1}.</span>
              <span className="flex-1 text-sm font-semibold truncate">{nameOf(id)}</span>
              <span className="text-[11px] num text-cream-500">{t('place')} {i + 1} → <b className="text-gold-300">+{pts} {t('pts')}</b></span>
              <button className="p-1 rounded hover:bg-felt-750 text-cream-500 disabled:opacity-25" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" size={15} /></button>
              <button className="p-1 rounded hover:bg-felt-750 text-cream-500 disabled:opacity-25" disabled={i === order.length - 1} onClick={() => move(i, 1)}><Icon name="down" size={15} /></button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
