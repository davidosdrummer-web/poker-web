import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useApp } from '../lib/store';
import { makeT } from '../lib/i18n';
import { fmtChips, fmtDate, fullName, leaderboardRows, rankMap } from '../lib/utils';
import { Avatar, Badge, Btn, Icon, ToastHost } from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { RatingChart } from '../components/RatingChart';
import { Achievements } from '../components/Achievements';
import { auth } from '../lib/auth';

export function PlayerDashboard() {
  const s = useApp();
  const t = makeT(s.settings.language);
  const user = useAuth();
  const [activeTab, setActiveTab] = useState<'rating' | 'history' | 'achievements'>('rating');
  const [isLoading, setIsLoading] = useState(true);

  // Находим игрока в базе клуба по userId
  const player = s.players.find(p => p.userId === user?.id);
  const rows = leaderboardRows(s.players, s.tournaments, null);
  const rank = player ? rankMap(rows).get(player.id) : null;
  const playerStats = player ? rows.find(r => r.playerId === player.id) : null;

  const history = s.tournaments
    .filter(tor => tor.status === 'finished' && tor.entries.some(e => e.playerId === player?.id))
    .sort((a, b) => b.date - a.date);

  // Ждем загрузки данных из Firebase и появления игрока в списке
  useEffect(() => {
    // Проверяем наличие игрока каждые 200мс, максимум 10 секунд
    let attempts = 0;
    const maxAttempts = 50;
    
    const checkPlayer = setInterval(() => {
      attempts++;
      const foundPlayer = s.players.find(p => p.userId === user?.id);
      
      if (foundPlayer || attempts >= maxAttempts) {
        clearInterval(checkPlayer);
        setIsLoading(false);
      }
    }, 200);
    
    return () => clearInterval(checkPlayer);
  }, [s.players.length, user?.id]);

  // Если данные еще загружаются
  if (isLoading) {
    return (
      <div className="min-h-screen bg-felt suit-pattern flex flex-col items-center justify-center p-4">
        <Icon name="loading" size={64} className="text-gold-400 animate-spin" />
        <h2 className="font-display text-3xl text-cream-100 mt-4">{t('loading')}</h2>
        <p className="text-sm text-cream-500 mt-2">Загрузка профиля игрока...</p>
      </div>
    );
  }

  // Если игрок не найден в базе клуба
  if (!player) {
    return (
      <div className="min-h-screen bg-felt suit-pattern flex flex-col items-center justify-center p-4">
        <Icon name="users" size={64} className="text-gold-400 opacity-60" />
        <h2 className="font-display text-3xl text-cream-100 mt-4">{t('player.notFound')}</h2>
        <p className="text-sm text-cream-500 mt-2 text-center max-w-md">{t('player.linkAccount')}</p>
        <Btn variant="gold" size="lg" icon="link" className="mt-6" onClick={() => window.location.href = '/'}>
          {t('player.linkAccount')}
        </Btn>
      </div>
    );
  }

  // Выход
  const handleLogout = async () => {
    await auth.logout();
  };

  return (
    <div className="min-h-screen bg-felt suit-pattern">
      {/* Шапка */}
      <header className="border-b border-line-soft bg-felt-950/85 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar
            name={fullName(player)}
            color={player.avatarColor}
            avatarData={player.avatarData ?? null}
            size={40}
          />
          <div>
            <div className="font-display text-lg text-cream-100">{fullName(player)}</div>
            <div className="text-xs text-cream-500">«{player.nickname}»</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Badge tone="gold">#{rank || '—'}</Badge>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md text-cream-500 hover:text-loss hover:bg-loss/10 transition-colors"
            title={t('logout')}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
      </header>

      {/* Основной контент */}
      <main className="max-w-3xl mx-auto p-4">
        {/* Краткая статистика */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="card p-4 text-center">
            <div className="text-[10px] uppercase text-cream-500">{t('player.points')}</div>
            <div className="font-display text-3xl num text-gold-300">{playerStats?.points || 0}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-[10px] uppercase text-cream-500">{t('player.played')}</div>
            <div className="font-display text-3xl num text-cream-100">{playerStats?.played || 0}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-[10px] uppercase text-cream-500">{t('player.wins')}</div>
            <div className="font-display text-3xl num text-win">{playerStats?.wins || 0}</div>
          </div>
        </div>

        {/* Дополнительная статистика */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="card p-3 text-center">
            <div className="text-[9px] uppercase text-cream-500">{t('top3')}</div>
            <div className="font-display text-xl num text-cream-100">{playerStats?.top3 || 0}</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-[9px] uppercase text-cream-500">{t('finals')}</div>
            <div className="font-display text-xl num text-cream-100">{playerStats?.finals || 0}</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-[9px] uppercase text-cream-500">{t('best')}</div>
            <div className="font-display text-xl num text-gold-300">{playerStats?.best || 0}</div>
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex gap-1 bg-felt-900 border border-line rounded-lg p-1 mb-4">
          {(['rating', 'history', 'achievements'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors ${
                activeTab === tab
                  ? 'bg-gold-400 text-felt-950'
                  : 'text-cream-500 hover:text-cream-100'
              }`}
            >
              {tab === 'rating' ? t('player.rating') : tab === 'history' ? t('player.history') : t('achievements') || 'Достижения'}
            </button>
          ))}
        </div>

        {/* Контент вкладок */}
        {activeTab === 'rating' && (
          <div className="card p-4">
            <RatingChart playerId={player.id} height={300} />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="card p-4">
            <h3 className="font-display text-lg text-gold-300 mb-3">{t('player.history')}</h3>
            {history.length === 0 ? (
              <div className="text-sm text-cream-500 italic py-2">{t('noHistory')}</div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
                {history.map(tor => {
                  const entry = tor.entries.find(e => e.playerId === player.id);
                  return (
                    <div key={tor.id} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-felt-900/50 px-3 py-2 text-xs">
                      <span className={`font-display text-base num w-8 ${
                        entry?.place === 1 ? 'text-gold-300' :
                        entry?.place === 2 ? 'text-[#dbe2e8]' :
                        entry?.place === 3 ? 'text-[#e0a86b]' :
                        'text-cream-500'
                      }`}>
                        {entry?.place || '—'}
                      </span>
                      <span className="flex-1 truncate font-semibold text-cream-100">{tor.name}</span>
                      <span className="num text-cream-700">{fmtDate(tor.date, s.settings.language)}</span>
                      <span className="num font-bold text-gold-300">+{entry?.points || 0}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="card p-4">
            <Achievements player={player} />
          </div>
        )}

        <div className="mt-4 text-center text-xs text-cream-700">
          {t('memberSince')} {fmtDate(player.joinedAt, s.settings.language)}
        </div>
      </main>
      <ToastHost />
    </div>
  );
}