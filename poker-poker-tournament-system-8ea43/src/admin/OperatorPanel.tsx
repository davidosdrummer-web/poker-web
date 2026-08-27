import { useEffect, useState, useReducer, useMemo } from 'react';
import { actions, can, getActiveTournament, getState, remainingSeconds, useApp } from '../lib/store';
import { auth, useAuth } from '../lib/auth';
import { makeT } from '../lib/i18n';
import { fmtClock, fmtInt, fmtChips, liveStats, fullName } from '../lib/utils';
import { playSfx } from '../lib/sfx';
import { Badge, Btn, Icon, ToastHost, Avatar } from '../components/ui';
import { openScreen } from './ScreensSettingsTabs';
import { EliminateModal, RebuyModal, FinishModal } from './LiveTab';
import { ThemeToggle } from '../components/ThemeToggle';

export function OperatorPanel() {
  const s = useApp();
  const t = makeT(s.settings.language);
  const user = useAuth();
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [breakMin, setBreakMin] = useState(10);
  const [elimOpen, setElimOpen] = useState(false);
  const [rebuyOpen, setRebuyOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clock, setClock] = useState('');

  const tor = getActiveTournament(s);
  const remaining = remainingSeconds(s, tor);
  const stats = useMemo(() => (tor ? liveStats(tor) : null), [tor, s.rev]);

  useEffect(() => {
    const id = window.setInterval(force, 300);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const f = () => setClock(new Date().toLocaleTimeString(s.settings.language === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' }));
    f();
    const id = window.setInterval(f, 10_000);
    return () => window.clearInterval(id);
  }, [s.settings.language]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const st = getState();
      const tor = getActiveTournament(st);
      if (!tor) return;
      if ((tor.status === 'running' || tor.status === 'break') && tor.levelEndsAt && tor.levelEndsAt <= Date.now()) {
        if (tor.status === 'break') actions.endBreak(tor.id);
        else actions.nextLevel(tor.id);
      }
      actions.checkAutoFinish(tor.id);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!user) {
    return <div className="min-h-screen bg-felt flex items-center justify-center text-cream-500">Загрузка...</div>;
  }

  const st = tor?.status;
  const preStart = st === 'scheduled' || st === 'registration';
  const level = tor?.levels[tor?.levelIndex ?? 0];
  const allowed = can('live');

  return (
    <div className="min-h-screen bg-felt flex flex-col">
      <header className="sticky top-0 z-40 border-b border-line-soft bg-felt-950/85 backdrop-blur px-4 py-3 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => setMenuOpen(true)} className="p-1.5 rounded-md text-cream-500 hover:text-cream-100 hover:bg-felt-800 transition-colors md:hidden">
            <Icon name="menu" size={24} />
          </button>
          <div>
            <div className="font-display text-lg text-gold-300">{s.settings.clubName}</div>
            <div className="text-[10px] text-cream-500">{user.username} · {t(`role.${user.role}`)}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="font-display text-lg num text-cream-300">{clock}</span>
          <button onClick={() => { auth.logout(); }} className="p-1.5 rounded-md text-cream-500 hover:text-loss hover:bg-loss/10 transition-colors" title={t('logout')}>
            <Icon name="x" size={18} />
          </button>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onOpenScreens={() => { setMenuOpen(false); }} />

      <main className="flex-1 p-4 suit-pattern">
        {!tor ? (
          <div className="card p-8 text-center">
            <Icon name="timer" size={48} className="mx-auto text-gold-400 opacity-60" />
            <h2 className="font-display text-2xl text-cream-100 mt-4">{t('noActiveTournament')}</h2>
            <p className="text-sm text-cream-500 mt-2">{t('pickTournament')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 max-w-lg mx-auto">
            <div className="card p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-display text-xl text-cream-100 truncate">{tor.name}</span>
                <Badge tone={st === 'running' ? 'green' : st === 'paused' ? 'red' : st === 'break' ? 'gold' : 'neutral'}>
                  {st === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-win anim-pulse-soft inline-block mr-1.5" />}
                  {st === 'running' ? t('status.running') : st === 'paused' ? t('status.paused') : st === 'break' ? t('status.break') : preStart ? t('status.registration') : t('status.scheduled')}
                </Badge>
              </div>
              <div className="text-xs text-cream-500 mt-1">{tor.entries.length} {t('participants')}</div>
            </div>

            <div className="card p-6 text-center">
              <div className={`font-display num text-7xl ${remaining !== null && remaining <= 30 && st === 'running' ? 'text-loss anim-blink' : 'text-cream-100'}`}>
                {preStart || st === 'finished' ? '--:--' : remaining !== null ? fmtClock(remaining) : '--:--'}
              </div>
              <div className="text-sm text-cream-500 mt-2">
                {st === 'break' ? t('timer.toBreakEnd') : st === 'paused' ? t('timer.paused') : preStart ? t('timer.notStarted') : st === 'finished' ? t('timer.finished') : t('timer.toNextLevel')}
              </div>
              {level && !preStart && (
                <div className="mt-3 flex items-center justify-center gap-4">
                  <span className="font-display text-3xl text-cream-100">{fmtInt(level.sb)} / {fmtInt(level.bb)}</span>
                  {level.ante > 0 && <span className="text-sm text-gold-300">A{fmtInt(level.ante)}</span>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {preStart ? (
                <Btn variant="gold" size="lg" icon="play" className="col-span-2 !py-4 !text-lg" disabled={!allowed || (tor?.entries?.length ?? 0) < 2} onClick={() => { actions.start(tor.id); playSfx('start', s.settings.sfx); }}>
                  {t('startTournament')}
                </Btn>
              ) : st === 'paused' ? (
                <Btn variant="gold" size="lg" icon="play" className="col-span-2 !py-4 !text-lg" disabled={!allowed} onClick={() => actions.resume(tor.id)}>
                  {t('resume')}
                </Btn>
              ) : (st === 'running' || st === 'break') && (
                <Btn variant="danger" size="lg" icon="pause" className="col-span-2 !py-4 !text-lg" disabled={!allowed} onClick={() => actions.pause(tor.id)}>
                  {t('pause')}
                </Btn>
              )}
              <Btn icon="next" size="lg" disabled={!allowed || preStart || st === 'finished'} onClick={() => { actions.nextLevel(tor.id); playSfx('level', s.settings.sfx); }}>
                {t('nextLevelBtn')}
              </Btn>
              {st === 'break' ? (
                <Btn icon="play" size="lg" variant="green" disabled={!allowed} onClick={() => { actions.endBreak(tor.id); playSfx('level', s.settings.sfx); }}>
                  {t('endBreak')}
                </Btn>
              ) : (
                <Btn icon="coffee" size="lg" disabled={!allowed || st !== 'running'} onClick={() => { actions.breakNow(tor.id, breakMin); playSfx('break', s.settings.sfx); }}>
                  {t('breakNow')} {breakMin}′
                </Btn>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Btn variant="dark" size="sm" icon="users" disabled={!allowed || stats?.active === 0 || st === 'finished'} onClick={() => setElimOpen(true)}>
                {t('eliminate')}
              </Btn>
              <Btn variant="dark" size="sm" icon="refresh" disabled={!allowed || stats?.active === 0 || st === 'finished' || preStart} onClick={() => setRebuyOpen(true)}>
                {t('rebuy')}
              </Btn>
              <Btn variant="dark" size="sm" icon="flag" disabled={!allowed || st === 'finished' || preStart} onClick={() => setFinishOpen(true)}>
                {t('finalize')}
              </Btn>
            </div>

            {stats && st !== 'scheduled' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="card p-3 text-center">
                  <div className="text-[10px] uppercase text-cream-500">{t('playersLeft')}</div>
                  <div className="font-display text-2xl num text-cream-100">{stats.active}</div>
                </div>
                <div className="card p-3 text-center">
                  <div className="text-[10px] uppercase text-cream-500">{t('avgStack')}</div>
                  <div className="font-display text-2xl num text-gold-300">{fmtChips(stats.avgStack)}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {elimOpen && tor && <EliminateModal tor={tor} onClose={() => setElimOpen(false)} />}
      {rebuyOpen && tor && <RebuyModal tor={tor} onClose={() => setRebuyOpen(false)} />}
      {finishOpen && tor && <FinishModal tor={tor} onClose={() => setFinishOpen(false)} />}
      <ToastHost />
    </div>
  );
}

/* ---------------- MobileMenu ---------------- */

function MobileMenu({ open, onClose, onOpenScreens }: { open: boolean; onClose: () => void; onOpenScreens: () => void }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const user = useAuth();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-72 max-w-[80%] h-full bg-felt-950 border-r border-line-soft p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <span className="font-display text-xl text-gold-300">{t('menu')}</span>
          <button onClick={onClose} className="p-1.5 rounded-md text-cream-500 hover:text-cream-100">
            <Icon name="x" size={24} />
          </button>
        </div>
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-line-soft">
          <div className="w-10 h-10 rounded-full bg-gold-400/15 border border-gold-400/30 flex items-center justify-center font-display text-lg text-gold-300 uppercase">
            {user?.username?.slice(0, 1) || '?'}
          </div>
          <div>
            <div className="font-semibold text-cream-100">{user?.username}</div>
            <div className="text-xs text-cream-500">{t(`role.${user?.role}`)}</div>
          </div>
        </div>
        <nav className="flex flex-col gap-2">
          <button onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gold-400/10 text-gold-300 border border-gold-400/25">
            <Icon name="timer" size={20} />
            <span className="font-semibold">{t('mobile.control')}</span>
          </button>
          <button onClick={() => { onOpenScreens(); onClose(); }} className="flex items-center gap-3 px-4 py-3 rounded-lg text-cream-500 hover:text-cream-100 hover:bg-felt-800 transition-colors">
            <Icon name="screen" size={20} />
            <span className="font-semibold">{t('screens')}</span>
          </button>
          <button onClick={() => { window.open('#/screen/live', '_blank'); onClose(); }} className="flex items-center gap-3 px-4 py-3 rounded-lg text-cream-500 hover:text-cream-100 hover:bg-felt-800 transition-colors">
            <Icon name="eye" size={20} />
            <span className="font-semibold">{t('liveScreen')}</span>
          </button>
          <button onClick={() => { window.open('#/screen/tables', '_blank'); onClose(); }} className="flex items-center gap-3 px-4 py-3 rounded-lg text-cream-500 hover:text-cream-100 hover:bg-felt-800 transition-colors">
            <Icon name="table" size={20} />
            <span className="font-semibold">{t('tablesScreen')}</span>
          </button>
          <button onClick={() => { window.open('#/screen/board', '_blank'); onClose(); }} className="flex items-center gap-3 px-4 py-3 rounded-lg text-cream-500 hover:text-cream-100 hover:bg-felt-800 transition-colors">
            <Icon name="trophy" size={20} />
            <span className="font-semibold">{t('boardScreen')}</span>
          </button>
          <button onClick={() => { window.open('#/screen/results', '_blank'); onClose(); }} className="flex items-center gap-3 px-4 py-3 rounded-lg text-cream-500 hover:text-cream-100 hover:bg-felt-800 transition-colors">
            <Icon name="crown" size={20} />
            <span className="font-semibold">{t('resultsScreen')}</span>
          </button>
          <button onClick={onClose} className="mt-4 flex items-center gap-3 px-4 py-3 rounded-lg text-loss hover:bg-loss/10 transition-colors">
            <Icon name="x" size={20} />
            <span className="font-semibold">{t('close')}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}