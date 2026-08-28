import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useApp, actions, can } from '../lib/store';
import { makeT } from '../lib/i18n';
import { fmtChips, fmtDate, fullName, leaderboardRows, rankMap } from '../lib/utils';
import { Avatar, Badge, Btn, Icon, ToastHost, toast } from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { RatingChart } from '../components/RatingChart';
import { Achievements } from '../components/Achievements';
import { auth } from '../lib/auth';
import type { Tournament } from '../lib/types';

export function PlayerDashboard() {
  const s = useApp();
  const t = makeT(s.settings.language);
  const user = useAuth();
  const [activeTab, setActiveTab] = useState<'rating' | 'history' | 'tournaments' | 'achievements'>('rating');

  // Находим игрока в базе клуба по userId
  const player = s.players.find(p => p.userId === user?.id);
  const rows = leaderboardRows(s.players, s.tournaments, null);
  const rank = player ? rankMap(rows).get(player.id) : null;
  const playerStats = player ? rows.find(r => r.playerId === player.id) : null;

  const history = s.tournaments
    .filter(tor => tor.status === 'finished' && tor.entries.some(e => e.playerId === player?.id))
    .sort((a, b) => b.date - a.date);

  // Доступные для регистрации турниры
  const availableTournaments = s.tournaments
    .filter(tor => (tor.status === 'scheduled' || tor.status === 'registration') && !tor.entries.some(e => e.playerId === player?.id))
    .sort((a, b) => a.date - b.date);

  // Зарегистрированные турниры
  const registeredTournaments = s.tournaments
    .filter(tor => (tor.status === 'scheduled' || tor.status === 'registration') && tor.entries.some(e => e.playerId === player?.id))
    .sort((a, b) => a.date - b.date);

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

  // Запись на турнир
  const handleRegister = (tournamentId: string) => {
    if (!player) return;
    actions.toggleEntry(tournamentId, player.id);
    toast(t('registered'));
  };

  // Отмена записи
  const handleUnregister = (tournamentId: string) => {
    if (!player) return;
    actions.toggleEntry(tournamentId, player.id);
    toast(t('unregistered'), 'warn');
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
      <main className="max-w-4xl mx-auto p-4">
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
          {(['rating', 'tournaments', 'history', 'achievements'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors ${
                activeTab === tab
                  ? 'bg-gold-400 text-felt-950'
                  : 'text-cream-500 hover:text-cream-100'
              }`}
            >
              {tab === 'rating' ? t('player.rating') : tab === 'tournaments' ? 'Турниры' : tab === 'history' ? t('player.history') : t('achievements') || 'Достижения'}
            </button>
          ))}
        </div>

        {/* Контент вкладок */}
        {activeTab === 'rating' && (
          <div className="card p-4">
            <RatingChart playerId={player.id} height={300} />
          </div>
        )}

        {activeTab === 'tournaments' && (
          <div className="space-y-4">
            {/* Зарегистрированные турниры */}
            {registeredTournaments.length > 0 && (
              <div className="card p-4">
                <h3 className="font-display text-lg text-gold-300 mb-3 flex items-center gap-2">
                  <Icon name="check" size={18} /> {t('registered')}
                </h3>
                <div className="flex flex-col gap-2">
                  {registeredTournaments.map(tor => {
                    const entry = tor.entries.find(e => e.playerId === player.id);
                    return (
                      <div key={tor.id} className="flex items-center gap-3 rounded-lg border border-line-soft bg-felt-900/50 px-3 py-2.5 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-cream-100 truncate">{tor.name}</div>
                          <div className="text-[10px] text-cream-500 num">{fmtDate(tor.date, s.settings.language)}</div>
                        </div>
                        <Badge tone="green">{t(`status.${tor.status}`)}</Badge>
                        <Btn 
                          size="sm" 
                          variant="danger" 
                          icon="x" 
                          onClick={() => handleUnregister(tor.id)}
                          disabled={tor.status === 'running'}
                        >
                          {t('cancel')}
                        </Btn>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Доступные для регистрации турниры */}
            <div className="card p-4">
              <h3 className="font-display text-lg text-gold-300 mb-3 flex items-center gap-2">
                <Icon name="plus" size={18} /> Доступные турниры
              </h3>
              {availableTournaments.length === 0 ? (
                <div className="text-sm text-cream-500 italic py-2">Нет доступных турниров</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {availableTournaments.map(tor => (
                    <div key={tor.id} className="flex items-center gap-3 rounded-lg border border-line-soft bg-felt-900/50 px-3 py-2.5 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-cream-100 truncate">{tor.name}</div>
                        <div className="text-[10px] text-cream-500 num">{fmtDate(tor.date, s.settings.language)}</div>
                      </div>
                      <Badge tone="info">{t(`status.${tor.status}`)}</Badge>
                      <Btn 
                        size="sm" 
                        variant="gold" 
                        icon="play" 
                        onClick={() => handleRegister(tor.id)}
                      >
                        {t('register')}
                      </Btn>
                    </div>
                  ))}
                </div>
              )}
            </div>
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