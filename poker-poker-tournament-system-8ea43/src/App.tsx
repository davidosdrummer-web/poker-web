import { useEffect, useState } from 'react';
import type { ScreenMode } from './lib/types';
import { AdminPanel } from './admin/AdminPanel';
import { ScreenView } from './screen/ScreenView';

type Route = { view: 'admin' } | { view: 'screen'; mode: ScreenMode };

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [root, param] = h.split('/');
  if (root === 'screen') {
    const mode = (['live', 'tables', 'board', 'results', 'table'].includes(param) ? param : 'live') as ScreenMode;
    return { view: 'screen', mode };
  }
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

  useEffect(() => {
    const f = () => setRoute(parseHash());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);

  useEffect(() => {
    document.title = route.view === 'screen' ? `${TITLES[route.mode]} — БЛАЙНД` : 'БЛАЙНД — рейтинговая система клуба';
  }, [route]);

  if (route.view === 'screen') {
    return (
      <div className="h-screen w-screen overflow-hidden bg-black">
        <ScreenView mode={route.mode} />
      </div>
    );
  }
  return <AdminPanel />;
}
