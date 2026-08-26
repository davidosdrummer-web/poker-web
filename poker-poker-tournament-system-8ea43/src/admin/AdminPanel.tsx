import { useEffect, useState } from 'react';
import { actions, can, getActiveTournament, getState, remainingSeconds, useApp } from '../lib/store';
import { auth, useAuth } from '../lib/auth';
import { makeT } from '../lib/i18n';
import { fmtClock } from '../lib/utils';
import { Badge, ClubLogo, Icon, KeyCap, Modal, ToastHost } from '../components/ui';
import { LiveTab } from './LiveTab';
import { TournamentsTab } from './TournamentsTab';
import { PlayersTab } from './PlayersTab';
import { LeaderboardTab } from './LeaderboardTab';
import { ScreensTab, SettingsTab } from './ScreensSettingsTabs';
import { AccountModal, AuthGate } from './AuthGate';

export type TabId = 'live' | 'tournaments' | 'players' | 'board' | 'screens' | 'settings';

const HK_ORDER: Record<string, number> = { live: 1, tournaments: 2, players: 3, board: 4, screens: 5, settings: 6 };

export function AdminPanel() {
  const s = useApp();
  const t = makeT(s.settings.language);
  const user = useAuth();
  const [tab, setTab] = useState<TabId>('live');
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorSection, setEditorSection] = useState('params');
  const [helpOpen, setHelpOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [clock, setClock] = useState('');

  const active = getActiveTournament(s);
  const remaining = remainingSeconds(s, active);
  const live = active && (active.status === 'running' || active.status === 'paused' || active.status === 'break');

  /* роль определяется аккаунтом */
  useEffect(() => {
  if (user) {
    console.log('user.role:', user.role);
    // Если роль пользователя не совпадает с сохранённой, обновляем
    if (s.settings.role !== user.role) {
      actions.setRole(user.role);
    }
    // Временно: если пользователь имеет админский email, принудительно ставим admin
    // (замените на ваш email)
    if (user.username === 'admin@poker.com' && user.role !== 'admin') {
      // Чтобы обновить роль в БД, нужно вызвать setUserRole
      // Но у нас нет прямого доступа из компонента – сделаем через auth
      // Но проще вручную исправить в Firebase Console
    }
  }
}, [user?.id, user?.role]);

  /* clock */
  useEffect(() => {
    const f = () => setClock(new Date().toLocaleTimeString(s.settings.language === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' }));
    f();
    const id = window.setInterval(f, 10_000);
    return () => window.clearInterval(id);
  }, [s.settings.language]);

  /* watchdog: auto-advance levels + auto-finish */
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

  /* hotkeys */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const st = getState();
      const tor = getActiveTournament(st);
      const key = e.key.toLowerCase();
      if (e.key === ' ') {
        if (tor && can('live')) {
          e.preventDefault();
          if (tor.status === 'running' || tor.status === 'break') actions.pause(tor.id);
          else if (tor.status === 'paused') actions.resume(tor.id);
        }
      } else if (key === 'n' && tor && can('live')) {
        e.preventDefault();
        actions.nextLevel(tor.id);
      } else if (key === 'b' && tor && can('live')) {
        e.preventDefault();
        if (tor.status === 'break') actions.endBreak(tor.id);
        else if (tor.status === 'running') actions.breakNow(tor.id, 10);
      } else if (key === 'q') {
        e.preventDefault();
        setHelpOpen((v) => !v);
      } else if (/^[1-6]$/.test(e.key)) {
        const order: TabId[] = ['live', 'tournaments', 'players', 'board', 'screens', 'settings'];
        const target = order[Number(e.key) - 1];
        if (target) {
          setTab(target);
          if (target !== 'tournaments') {
            setEditorId(null);
          }
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const openEditor = (id: string, section?: string) => {
    setTab('tournaments');
    setEditorId(id || null);
    setEditorSection(section || 'params');
  };

  const tabs: { id: TabId; icon: string; label: string; count?: string; alert?: boolean }[] = [
    { id: 'live', icon: 'timer', label: t('nav.live'), count: live && remaining != null ? fmtClock(remaining) : undefined },
    { id: 'tournaments', icon: 'trophy', label: t('nav.tournaments'), count: String(s.tournaments.length) },
    { id: 'players', icon: 'users', label: t('nav.players'), count: String(s.players.length) },
    { id: 'board', icon: 'hand', label: t('nav.board') },
    { id: 'screens', icon: 'screen', label: t('nav.screens') },
    { id: 'settings', icon: 'settings', label: t('nav.settings') },
  ];

  const statusMeta: Record<string, { label: string; tone: 'gold' | 'green' | 'red' | 'info' | 'neutral' }> = {
    scheduled: { label: t('status.scheduled'), tone: 'neutral' },
    registration: { label: t('status.registration'), tone: 'info' },
    running: { label: t('status.running'), tone: 'green' },
    paused: { label: t('status.paused'), tone: 'red' },
    break: { label: t('status.break'), tone: 'gold' },
    finished: { label: t('status.finished'), tone: 'neutral' },
  };

  if (!user) {
    return (
      <>
        <AuthGate />
        <ToastHost />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-felt flex">
      {/* sidebar */}
      <aside className="w-[218px] shrink-0 border-r border-line-soft bg-felt-950/70 backdrop-blur flex flex-col sticky top-0 h-screen no-print">
        <div className="px-4 py-4 flex items-center gap-2.5 border-b border-line-soft">
          <ClubLogo logo={s.settings.logo} size={34} accent={s.settings.accent} />
          <div className="min-w-0">
            <div className="font-display text-lg leading-none text-cream-100 truncate">{s.settings.clubName}</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-gold-500 font-bold mt-0.5">{t('app.tagline')}</div>
          </div>
        </div>
        <nav className="flex-1 p-2.5 flex flex-col gap-1 overflow-y-auto">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => { setTab(tb.id); if (tb.id !== 'tournaments') setEditorId(null); }}
              className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === tb.id ? 'bg-gold-400/12 text-gold-300 border border-gold-400/25' : 'text-cream-500 hover:text-cream-100 hover:bg-felt-800 border border-transparent'}`}
            >
              <Icon name={tb.icon} size={17} />
              <span className="flex-1 text-left">{tb.label}</span>
              {tb.alert && <span className="w-1.5 h-1.5 rounded-full bg-gold-400 anim-pulse-soft" />}
              {tb.count && <span className={`text-[10px] num font-bold ${tab === tb.id ? 'text-gold-400' : 'text-cream-700 group-hover:text-cream-500'}`}>{tb.count}</span>}
              <KeyCap>{HK_ORDER[tb.id]}</KeyCap>
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-line-soft">
          <button onClick={() => setHelpOpen(true)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-cream-500 hover:text-cream-100 hover:bg-felt-800 transition-colors">
            <Icon name="keyboard" size={15} /> {t('hotkeys')} <span className="flex-1" /> <KeyCap>Q</KeyCap>
          </button>
          <div className="flex items-center gap-2 px-3 pt-2 text-[10px] text-cream-700 num">
            <span className="w-1.5 h-1.5 rounded-full bg-win anim-pulse-soft" /> {t('sync')} · rev {s.rev}
          </div>
        </div>
      </aside>

      {/* main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-40 border-b border-line-soft bg-felt-950/85 backdrop-blur px-5 py-3 flex items-center gap-4 no-print">
          <div className="min-w-0 flex-1">
            {active ? (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-display text-xl text-cream-100 truncate">{active.name}</span>
                <Badge tone={statusMeta[active.status].tone}>
                  {active.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-win anim-pulse-soft" />}
                  {statusMeta[active.status].label}
                </Badge>
                {live && remaining != null && (
                  <span className={`font-display text-xl num ${remaining <= 30 && active.status === 'running' ? 'text-loss anim-blink' : 'text-gold-300'}`}>{fmtClock(remaining)}</span>
                )}
              </div>
            ) : (
              <span className="font-display text-xl text-cream-500">{t('noActiveTournament')}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-felt-900 pl-1.5 pr-1 py-1">
            <div className="w-7 h-7 rounded-md bg-gold-400/15 border border-gold-400/30 flex items-center justify-center font-display text-base text-gold-300 uppercase">
              {user.username.slice(0, 1)}
            </div>
            <button onClick={() => setAccountOpen(true)} className="text-left leading-tight px-1 group" title={t('account')}>
              <div className="text-xs font-bold text-cream-100 group-hover:text-gold-300 transition-colors max-w-[110px] truncate">{user.username}</div>
              <div className="text-[9px] uppercase tracking-wider text-cream-700 font-bold">{t(`role.${user.role}`)}</div>
            </button>
            <button onClick={async () => { await auth.logout(); }} className="p-1.5 rounded-md text-cream-500 hover:text-loss hover:bg-loss/10 transition-colors" title={t('logout')}>
              <Icon name="x" size={14} />
            </button>
          </div>
          <span className="font-display text-xl num text-cream-300">{clock}</span>
        </header>

        <main className="flex-1 p-5 suit-pattern">
          {tab === 'live' && <LiveTab onOpenEditor={openEditor} />}
          {tab === 'tournaments' && (
            <TournamentsTab editorId={editorId} section={editorSection} onOpenEditor={openEditor} onCloseEditor={() => setEditorId(null)} onGoLive={() => { setEditorId(null); setTab('live'); }} />
          )}
          {tab === 'players' && <PlayersTab />}
          {tab === 'board' && <LeaderboardTab />}
          {tab === 'screens' && <ScreensTab />}
          {tab === 'settings' && <SettingsTab />}
        </main>
      </div>

      {helpOpen && (
        <Modal title={t('hotkeys')} onClose={() => setHelpOpen(false)}>
          <div className="grid gap-2.5 text-sm text-cream-300">
            <HotkeyRow k="Space" label={t('hk.space')} />
            <HotkeyRow k="N" label={t('hk.n')} />
            <HotkeyRow k="B" label={t('hk.b')} />
            <HotkeyRow k="E" label={`${t('hk.e')} (${t('nav.live')})`} />
            <HotkeyRow k="1–6" label={t('hk.digits')} />
            <HotkeyRow k="Q" label={t('hk.q')} />
          </div>
        </Modal>
      )}
      {accountOpen && <AccountModal user={user} onClose={() => setAccountOpen(false)} />}
      <ToastHost />
    </div>
  );
}

function HotkeyRow({ k, label }: { k: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <KeyCap>{k}</KeyCap>
      <span>{label}</span>
    </div>
  );
}
