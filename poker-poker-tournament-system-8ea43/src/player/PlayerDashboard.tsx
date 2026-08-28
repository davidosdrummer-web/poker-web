import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PlayerDashboard = () => {
  const { tournaments, currentUser, subscribeToTournaments } = useStore();
  const [activeTab, setActiveTab] = useState('tournaments');
  const [selectedTournament, setSelectedTournament] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToTournaments();
    return unsubscribe;
  }, []);

  const handleRegister = async (tournamentId) => {
    await useStore.getState().toggleEntry(tournamentId);
  };

  const formatTime = (date) => {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStatusMessage = (tournament, player) => {
    if (player?.eliminated) {
      return `Выбыл на ${player.eliminationPlace} месте`;
    }
    
    if (tournament.status === 'inProgress' && !player?.eliminated) {
      return `В игре - стек: ${player?.stack || 0}`;
    }
    
    if (tournament.status === 'registration') {
      return 'Регистрация открыта';
    }
    
    return 'Завершён';
  };

  const renderProfileTab = () => (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Профиль</h2>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Информация</h3>
        <p>Имя: {currentUser?.name}</p>
        <p>ID: {currentUser?.id}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">Рейтинг</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={[
              { date: 'Янв', rating: 50 },
              { date: 'Фев', rating: 55 },
              { date: 'Мар', rating: 60 },
              { date: 'Апр', rating: 58 },
              { date: 'Май', rating: 62 }
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="rating" stroke="#8884d8" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderTournamentsTab = () => (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Турниры</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tournaments.map((tournament) => {
          const isRegistered = tournament.registeredPlayers.includes(currentUser?.id);
          const player = tournament.players[currentUser?.id];
          
          return (
            <div 
              key={tournament.id}
              className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedTournament(tournament)}
            >
              <h3 className="text-xl font-semibold mb-2">{tournament.name}</h3>
              <p className="text-gray-600 mb-2">{tournament.description}</p>
              
              <div className="mb-4">
                <p>Старт: {formatTime(tournament.startDate)}</p>
                <p>Стек: {tournament.startingStack}</p>
                <p>Ребай: {tournament.rebuyCost}</p>
                <p>Аддон: {tournament.addonCost}</p>
              </div>
              
              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded text-sm ${
                  player ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {getStatusMessage(tournament, player)}
                </span>
                
                {!isRegistered && tournament.status === 'registration' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRegister(tournament.id);
                    }}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                  >
                    Буду участвовать
                  </button>
                )}
                
                {isRegistered && tournament.status === 'registration' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRegister(tournament.id);
                    }}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                  >
                    Отменить регистрацию
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">История</h2>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Турнир
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Дата
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Место
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Приз
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tournaments
              .filter(t => t.status === 'completed')
              .map(tournament => {
                const player = tournament.players[currentUser?.id];
                if (!player || !player.eliminationPlace) return null;
                
                return (
                  <tr key={tournament.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{tournament.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatTime(tournament.startDate)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{player.eliminationPlace} место</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{player.prize || 0} ₽</div>
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAchievementsTab = () => (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Достижения</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Первый турнир</h3>
          <p className="text-gray-600">Участие в первом турнире</p>
          <div className="mt-4 w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
            🏆
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Победитель</h3>
          <p className="text-gray-600">Победа в турнире</p>
          <div className="mt-4 w-16 h-16 bg-gold-100 rounded-full flex items-center justify-center">
            👑
          </div>
        </div>
      </div>
    </div>
  );

  const renderTournamentDetail = () => {
    if (!selectedTournament) return null;

    const player = selectedTournament.players[currentUser?.id];
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-screen overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{selectedTournament.name}</h2>
              <button 
                onClick={() => setSelectedTournament(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Описание</h3>
                <p>{selectedTournament.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold">Дата старта</h3>
                  <p>{formatTime(selectedTournament.startDate)}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold">Статус</h3>
                  <p>{selectedTournament.status}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h3 className="font-semibold">Стек</h3>
                  <p>{selectedTournament.startingStack}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold">Ребай</h3>
                  <p>{selectedTournament.rebuyCost}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold">Аддон</h3>
                  <p>{selectedTournament.addonCost}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold">Окончание регистрации</h3>
                  <p>{formatTime(selectedTournament.registrationEnds)}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold">Окончание докупов</h3>
                  <p>{formatTime(selectedTournament.rebuyTimeEnds)}</p>
                </div>
              </div>
              
              {player && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Ваш статус</h3>
                  
                  {player.eliminated ? (
                    <div>
                      <p>Статус: Выбыл на {player.eliminationPlace} месте</p>
                      {new Date() < selectedTournament.rebuyTimeEnds && (
                        <button className="mt-2 bg-blue-500 text-white px-4 py-2 rounded">
                          Ре-ентри (если доступно)
                        </button>
                      )}
                    </div>
                  ) : selectedTournament.status === 'inProgress' ? (
                    <div>
                      <p>Стек: {player.stack}</p>
                      <p>Стол: {player.tableId}, Место: {player.seat}</p>
                      <p>Ребай: {player.rebuys}, Аддон: {player.addons}</p>
                      <p>До следующего уровня: {selectedTournament.nextBreakInMinutes} мин</p>
                    </div>
                  ) : (
                    <p>Статус: Зарегистрирован</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`${
                    activeTab === 'profile'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Профиль
                </button>
                
                <button
                  onClick={() => setActiveTab('tournaments')}
                  className={`${
                    activeTab === 'tournaments'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Турниры
                </button>
                
                <button
                  onClick={() => setActiveTab('history')}
                  className={`${
                    activeTab === 'history'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  История
                </button>
                
                <button
                  onClick={() => setActiveTab('achievements')}
                  className={`${
                    activeTab === 'achievements'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Достижения
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {activeTab === 'profile' && renderProfileTab()}
      {activeTab === 'tournaments' && renderTournamentsTab()}
      {activeTab === 'history' && renderHistoryTab()}
      {activeTab === 'achievements' && renderAchievementsTab()}

      {selectedTournament && renderTournamentDetail()}
    </div>
  );
};

export default PlayerDashboard;
