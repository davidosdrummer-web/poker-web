import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useApp, actions, can, remainingSeconds } from '../lib/store';
import { makeT } from '../lib/i18n';
import { fmtChips, fmtDate, fmtClock, fullName, leaderboardRows, rankMap } from '../lib/utils';
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
  const [activeTab, setActiveTab] = useState<'profile' | 'tournaments' | 'history' | 'achievements'>('profile');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

  // Находим игрока в базе клуба по userId
  const player = s.players.find(p => p.userId === user?.id);
  const rows = player ? leaderboardRows(s.players, s.tournaments, null) : [];
  const rank = player ? rankMap(rows).get(player.id) : null;
  const playerStats = player ? rows.find(r => r.playerId === player.id) : null;

  const history = s.tournaments
    .filter(tor => tor.status === 'finished' && tor.entries.some(e => e.playerId === player?.id))
    .sort((a, b) => b.date - a.date);

  // Доступные для регистрации турниры
  const availableTournaments = s.tournaments
    .filter(tor => (tor.status === 'scheduled' || tor.status === 'registration') && !tor.entries.some(e => e.playerId === player?.id))
    .sort((a, b) => a.date - b.date);

  // Зарегистрированные турниры (активные)
  const registeredTournaments = s.tournaments
    .filter(tor => (tor.status === 'scheduled' || tor.status === 'registration' || tor.status === 'running' || tor.status === 'paused' || tor.status === 'break') && tor.entries.some(e => e.playerId === player?.id))
    .sort((a, b) => a.date - b.date);

  // Если игрок не найден в базе клуба
  if (!player) {
    return (
      <div className="min-h-screen bg-felt suit-pattern flex flex-col items-center justify-center p-4">
        <Icon name="users" size={64} className="text-gold-400 opacity-60" />
        <h2 className="font-display text-3xl text-cream-100 mt-4">{t('player.notFound')}</h2>
        <p className="text-sm text-cream-500 mt-2 text-center max-w-md">{t('player.linkAccount')}</p>
        <Btn variant="gold" size="lg" icon="link" className="mt-6" onClick={() => window.location.reload()}>
          Обновить страницу
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

  // Детали турнира
  const TournamentDetails = ({ tournament }: { tournament: Tournament }) => {
    const entry = tournament.entries.find(e => e.playerId === player.id);
    const isRegistered = !!entry;
    const remaining = remainingSeconds(s, tournament);
    const regClosed = tournament.registrationClosesAt != null && Date.now() > tournament.registrationClosesAt;
    const rebuyClosed = tournament.rebuyClosesAt != null && Date.now() > tournament.rebuyClosesAt;

    return (
      <div className="card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl text-gold-300">{tournament.name}</h3>
            {tournament.description && (
              <p className="text-xs text-cream-500 mt-1">{tournament.description}</p>
            )}
          </div>
          <button onClick={() => setSelectedTournament(null)} className="p-1 rounded hover:bg-felt-800 text-cream-500">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-felt-900/50 rounded-lg p-2 border border-line-soft">
            <div className="text-[9px] uppercase text-cream-500">Дата и время</div>
            <div className="font-semibold text-cream-100 num">{fmtDate(tournament.date, s.settings.language)}</div>
          </div>
          <div className="bg-felt-900/50 rounded-lg p-2 border border-line-soft">
            <div className="text-[9px] uppercase text-cream-500">Начальный стек</div>
            <div className="font-semibold text-cream-100 num">{fmtChips(tournament.startingStack)}</div>
          </div>
          <div className="bg-felt-900/50 rounded-lg p-2 border border-line-soft">
            <div className="text-[9px] uppercase text-cream-500">Ребай</div>
            <div className="font-semibold text-cream-100 num">{fmtChips(tournament.rebuyChips)}</div>
          </div>
          <div className="bg-felt-900/50 rounded-lg p-2 border border-line-soft">
            <div className="text-[9px] uppercase text-cream-500">Аддон</div>
            <div className="font-semibold text-cream-100 num">{fmtChips(tournament.addonChips)}</div>
          </div>
          <div className="bg-felt-900/50 rounded-lg p-2 border border-line-soft">
            <div className="text-[9px] uppercase text-cream-500">Регистрация до</div>
            <div className="font-semibold text-cream-100 num">{tournament.registrationClosesAt ? fmtDate(tournament.registrationClosesAt, s.settings.language) : '—'}</div>
          </div>
          <div className="bg-felt-900/50 rounded-lg p-2 border border-line-soft">
            <div className="text-[9px] uppercase text-cream-500">Докупы до</div>
            <div className="font-semibold text-cream-100 num">{tournament.rebuyClosesAt ? fmtDate(tournament.rebuyClosesAt, s.settings.language) : '—'}</div>
          </div>
        </div>

        {/* Статус турнира для зарегистрированного игрока */}
        {isRegistered && entry && (
          <div className="border-t border-line-soft pt-3 space-y-2">
            <h4 className="font-display text-sm text-gold-300">Ваш статус</h4>
            
            {tournament.status === 'scheduled' || tournament.status === 'registration' ? (
              <Badge tone="info">Зарегистрирован</Badge>
            ) : tournament.status === 'running' || tournament.status === 'paused' || tournament.status === 'break' ? (
              <>
                {entry.eliminated ? (
                  <div className="space-y-2">
                    <Badge tone="red">Выбыл</Badge>
                    {entry.place && (
                      <div className="text-xs text-cream-500">
                        Место: <span className="font-bold text-gold-300">{entry.place}</span>
                      </div>
                    )}
                    {!rebuyClosed && (
                      <div className="text-xs text-cream-500 italic">
                        Можно сделать ре-ентри
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Badge tone="green">В игре</Badge>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-felt-900/50 rounded p-2">
                        <div className="text-[9px] uppercase text-cream-500">Стек</div>
                        <div className="font-bold text-cream-100 num">{fmtChips(entry.stack)}</div>
                      </div>
                      <div className="bg-felt-900/50 rounded p-2">
                        <div className="text-[9px] uppercase text-cream-500">Место</div>
                        <div className="font-bold text-cream-100">
                          {entry.tableId && entry.seat != null ? (
                            <>Стол {entry.seat}</>
                          ) : (
                            <span className="text-cream-500">Ожидание</span>
                          )}
                        </div>
                      </div>
                      <div className="bg-felt-900/50 rounded p-2">
                        <div className="text-[9px] uppercase text-cream-500">Ребаев</div>
                        <div className="font-bold text-cream-100 num">{entry.rebuys}</div>
                      </div>
                      <div className="bg-felt-900/50 rounded p-2">
                        <div className="text-[9px] uppercase text-cream-500">Аддонов</div>
                        <div className="font-bold text-cream-100 num">{entry.addons}</div>
                      </div>
                    </div>
                    {remaining != null && (
                      <div className="flex items-center gap-2 text-xs">
                        <Icon name="timer" size={14} className="text-gold-300" />
                        <span className="text-cream-500">До уровня:</span>
                        <span className={`font-mono font-bold ${remaining <= 30 ? 'text-loss' : 'text-gold-300'}`}>
                          {fmtClock(remaining)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : tournament.status === 'finished' ? (
              <div className="space-y-2">
                <Badge tone="neutral">Завершён</Badge>
                {entry.place && (
                  <div className="text-xs text-cream-500">
                    Ваше место: <span className={`font-bold ${entry.place === 1 ? 'text-gold-300' : entry.place === 2 ? 'text-[#dbe2e8]' : entry.place === 3 ? 'text-[#e0a86b]' : 'text-cream-100'}`}>{entry.place}</span>
                  </div>
                )}
                {entry.points && (
                  <div className="text-xs text-cream-500">
                    Очков: <span className="font-bold text-gold-300">+{entry.points}</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Кнопки действий */}
        <div className="flex gap-2 pt-2">
          {!isRegistered ? (
            <Btn 
              variant="gold" 
              icon="play" 
              className="flex-1"
              onClick={() => handleRegister(tournament.id)}
              disabled={regClosed || tournament.status === 'finished'}
            >
              {regClosed ? 'Регистрация закрыта' : 'Буду участвовать'}
            </Btn>
          ) : (tournament.status === 'scheduled' || tournament.status === 'registration') && !regClosed ? (
            <Btn 
              variant="danger" 
              icon="x" 
              className="flex-1"
              onClick={() => handleUnregister(tournament.id)}
            >
              Отменить регистрацию
            </Btn>
          ) : null}
        </div>
      </div>
    );
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
          {(['profile', 'tournaments', 'history', 'achievements'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSelectedTournament(null); }}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors ${
                activeTab === tab
                  ? 'bg-gold-400 text-felt-950'
                  : 'text-cream-500 hover:text-cream-100'
              }`}
            >
              {tab === 'profile' ? 'Профиль' : tab === 'tournaments' ? 'Турниры' : tab === 'history' ? t('player.history') : (t('achievements') || 'Достижения')}
            </button>
          ))}
        </div>

        {/* Контент вкладок */}
        {activeTab === 'profile' && (
          <div className="card p-4">
            <h3 className="font-display text-lg text-gold-300 mb-3">Профиль игрока</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-line-soft">
                <span className="text-cream-500">ФИО</span>
                <span className="text-cream-100 font-semibold">{fullName(player)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-soft">
                <span className="text-cream-500">Никнейм</span>
                <span className="text-cream-100 font-semibold">«{player.nickname}»</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-soft">
                <span className="text-cream-500">Телефон</span>
                <span className="text-cream-100">{player.phone || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-soft">
                <span className="text-cream-500">В клубе с</span>
                <span className="text-cream-100 num">{fmtDate(player.joinedAt, s.settings.language)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-cream-500">Статус</span>
                <Badge tone={player.status === 'active' ? 'green' : 'neutral'}>
                  {player.status === 'active' ? 'Активен' : 'Не активен'}
                </Badge>
              </div>
            </div>
            <RatingChart playerId={player.id} height={250} className="mt-4" />
          </div>
        )}

        {activeTab === 'tournaments' && selectedTournament ? (
          <TournamentDetails tournament={selectedTournament} />
        ) : activeTab === 'tournaments' && (
          <div className="space-y-4">
            {/* Активные зарегистрированные турниры */}
            {registeredTournaments.filter(t => t.status !== 'finished').length > 0 && (
              <div className="card p-4">
                <h3 className="font-display text-lg text-gold-300 mb-3 flex items-center gap-2">
                  <Icon name="trophy" size={18} /> Мои турниры
                </h3>
                <div className="flex flex-col gap-2">
                  {registeredTournaments.filter(t => t.status !== 'finished').map(tor => {
                    const entry = tor.entries.find(e => e.playerId === player.id);
                    const isEliminated = entry?.eliminated;
                    const statusMeta: Record<string, { label: string; tone: 'gold' | 'green' | 'red' | 'info' | 'neutral' }> = {
                      scheduled: { label: t('status.scheduled'), tone: 'neutral' },
                      registration: { label: t('status.registration'), tone: 'info' },
                      running: { label: t('status.running'), tone: 'green' },
                      paused: { label: t('status.paused'), tone: 'red' },
                      break: { label: t('status.break'), tone: 'gold' },
                      finished: { label: t('status.finished'), tone: 'neutral' },
                    };
                    return (
                      <button
                        key={tor.id}
                        onClick={() => setSelectedTournament(tor)}
                        className="flex items-center gap-3 rounded-lg border border-line-soft bg-felt-900/50 px-3 py-2.5 text-xs hover:bg-felt-800/70 transition-colors w-full text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-cream-100 truncate">{tor.name}</div>
                          <div className="text-[10px] text-cream-500 num">{fmtDate(tor.date, s.settings.language)}</div>
                          {entry && !entry.eliminated && entry.tableId && entry.seat != null && (
                            <div className="text-[10px] text-gold-300">Стол {entry.seat}</div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge tone={statusMeta[tor.status].tone}>{statusMeta[tor.status].label}</Badge>
                          {isEliminated && <Badge tone="red">Выбыл</Badge>}
                        </div>
                      </button>
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
                    <button
                      key={tor.id}
                      onClick={() => setSelectedTournament(tor)}
                      className="flex items-center gap-3 rounded-lg border border-line-soft bg-felt-900/50 px-3 py-2.5 text-xs hover:bg-felt-800/70 transition-colors w-full text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-cream-100 truncate">{tor.name}</div>
                        <div className="text-[10px] text-cream-500 num">{fmtDate(tor.date, s.settings.language)}</div>
                      </div>
                      <Badge tone="info">{t(`status.${tor.status}`)}</Badge>
                    </button>
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
      </main>
      <ToastHost />
    </div>
  );
}