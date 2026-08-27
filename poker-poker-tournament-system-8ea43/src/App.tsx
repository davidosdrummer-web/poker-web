import { useEffect, useState } from 'react';
import type { ScreenMode } from './lib/types';
import { AdminPanel } from './admin/AdminPanel';
import { OperatorPanel } from './admin/OperatorPanel';
import { ScreenView } from './screen/ScreenView';
import { PlayerDashboard } from './player/PlayerDashboard';
import { RegisterPlayer } from './player/RegisterPlayer';
import { PublicProfile } from './player/PublicProfile';
import { useAuth } from './lib/auth';
import { AuthGate } from './admin/AuthGate';
import { ThemeProvider } from './lib/themeContext';
import { AnimatedBackground } from './components/AnimatedBackground';

type Route = 
  | { view: 'admin' } 
  | { view: 'screen'; mode: ScreenMode } 
  | { view: 'register' } 
  | { view: 'player' } 
  | { view: 'profile'; playerId: string };

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  const parts = h.split('/');
  const [root, param] = parts;
  
  if (root === 'screen') {
    const mode = (['live', 'tables', 'board', 'results', 'table'].includes(param) ? param : 'live') as ScreenMode;
    return { view: 'screen', mode };
  }
  if (root === 'register') return { view: 'register' };
  if (root === 'player') return { view: 'player' };
  if (root === 'profile' && param) return { view: 'profile', playerId: param };
  return { view: 'admin' };
}

const TITLES: Record<ScreenMode, string> = {
  live: 'Live — уровень и блайнды',
  tables: 'Рассадка по столам',
  board: 'Рейтинг клуба',
  results: 'Итоги турнира',
  table: 'Турнирная таблица (лайв)',
};

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const user = useAuth();

  useEffect(() => {
    const f = () => setRoute(parseHash());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);

  useEffect(() => {
    document.title = route.view === 'screen' 
      ? `${TITLES[route.mode]} — БЛАЙНД` 
      : 'БЛАЙНД — рейтинговая система клуба';
  }, [route]);

  // Экраны – доступны без входа
  if (route.view === 'screen') {
    return (
      <div className="h-screen w-screen overflow-hidden bg-black">
        <ScreenView mode={route.mode} />
      </div>
    );
  }

  // Страница регистрации – доступна без входа
  if (route.view === 'register') {
    return (
      <ThemeProvider>
        <AnimatedBackground />
        <RegisterPlayer />
      </ThemeProvider>
    );
  }

  // Публичный профиль – доступен без входа
  if (route.view === 'profile' && route.playerId) {
    return (
      <ThemeProvider>
        <AnimatedBackground />
        <PublicProfile playerId={route.playerId} />
      </ThemeProvider>
    );
  }

  // Если пользователь не авторизован – показываем вход
  if (!user) {
    return (
      <ThemeProvider>
        <AnimatedBackground />
        <AuthGate />
      </ThemeProvider>
    );
  }

  // Маршрутизация по ролям
  if (user.role === 'player') {
    return (
      <ThemeProvider>
        <AnimatedBackground />
        <PlayerDashboard />
      </ThemeProvider>
    );
  }

  if (user.role === 'operator') {
    return (
      <ThemeProvider>
        <AnimatedBackground />
        <OperatorPanel />
      </ThemeProvider>
    );
  }

  // admin или неизвестная роль
  return (
    <ThemeProvider>
      <AnimatedBackground />
      <AdminPanel />
    </ThemeProvider>
  );
}