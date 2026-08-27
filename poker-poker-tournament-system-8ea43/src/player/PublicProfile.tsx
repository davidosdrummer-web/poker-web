import { useEffect, useState } from 'react';
import { useApp } from '../lib/store';
import { makeT } from '../lib/i18n';
import { fullName, leaderboardRows, rankMap, fmtDate } from '../lib/utils';
import { Avatar, Badge, Icon, Btn, ToastHost } from '../components/ui';
import { RatingChart } from '../components/RatingChart';

interface PublicProfileProps {
  playerId: string;
}

export function PublicProfile({ playerId }: PublicProfileProps) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [player, setPlayer] = useState(s.players.find((p) => p.id === playerId));

  useEffect(() => {
    setPlayer(s.players.find((p) => p.id === playerId));
  }, [s.players, playerId]);

  if (!player) {
    return (
      <div className="min-h-screen bg-felt flex items-center justify-center">
        <div className="text-center text-cream-500">
          <Icon name="users" size={48} className="mx-auto opacity-40" />
          <p className="mt-2">{t('playerNotFound') || 'Игрок не найден'}</p>
        </div>
      </div>
    );
  }

  const rows = leaderboardRows(s.players, s.tournaments, null);
  const rank = rankMap(rows).get(player.id);
  const stats = rows.find((r) => r.playerId === player.id);

  return (
    <div className="min-h-screen bg-felt suit-pattern">
      <div className="max-w-4xl mx-auto p-4">
        {/* Шапка профиля */}
        <div className="card p-6 mb-4">
          <div className="flex items-center gap-4">
            <Avatar
              name={fullName(player)}
              color={player.avatarColor}
              avatarData={player.avatarData ?? null}
              size={64}
            />
            <div>
              <h1 className="font-display text-3xl text-cream-100">
                {fullName(player)}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <Badge tone="gold">#{rank || '—'}</Badge>
                <span className="text-sm text-cream-500">«{player.nickname}»</span>
                <span className="text-xs text-cream-700">
                  {t('memberSince')} {fmtDate(player.joinedAt, s.settings.language)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="card p-4 text-center">
            <div className="text-[10px] uppercase text-cream-500">{t('totalPoints')}</div>
            <div className="font-display text-2xl text-gold-300">{stats?.points || 0}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-[10px] uppercase text-cream-500">{t('played')}</div>
            <div className="font-display text-2xl text-cream-100">{stats?.played || 0}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-[10px] uppercase text-cream-500">{t('wins')}</div>
            <div className="font-display text-2xl text-win">{stats?.wins || 0}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-[10px] uppercase text-cream-500">{t('top3')}</div>
            <div className="font-display text-2xl text-gold-300">{stats?.top3 || 0}</div>
          </div>
        </div>

        {/* График */}
        <div className="card p-4 mb-4">
          <RatingChart playerId={player.id} height={250} showHistory={false} />
        </div>

        {/* Кнопка возврата */}
        <Btn variant="ghost" icon="up" onClick={() => window.history.back()}>
          {t('back') || 'Назад'}
        </Btn>
      </div>
      <ToastHost />
    </div>
  );
}