import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';

const AdminPanel = () => {
  const { tournaments, subscribeToTournaments, assignSeat, eliminate, rebuyStack, addAddon, setTournamentStatus } = useStore();
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToTournaments();
    return unsubscribe;
  }, []);

  const handleAssignSeat = async (playerId, tableId, seat) => {
    if (selectedTournament) {
      await assignSeat(selectedTournament.id, playerId, tableId, seat);
    }
  };

  const handleEliminate = async (playerId, eliminatedBy) => {
    if (selectedTournament) {
      await eliminate(selectedTournament.id, playerId, eliminatedBy);
    }
  };

  const handleRebuy = async (playerId) => {
    if (selectedTournament) {
      await rebuyStack(selectedTournament.id, playerId);
    }
  };

  const handleAddAddon = async (playerId) => {
    if (selectedTournament) {
      await addAddon(selectedTournament.id, playerId);
    }
  };

  const handleSetStatus = async (status) => {
    if (selectedTournament) {
      await setTournamentStatus(selectedTournament.id, status);
    }
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

  const renderTournamentList = () => (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Турниры</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tournaments.map((tournament) => (
          <div 
            key={tournament.id}
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedTournament(tournament)}
          >
            <h3 className="text-xl font-semibold mb-2">{tournament.name}</h3>
            <p className="text-gray-600 mb-2">{tournament.description}</p>
            <p>Участников: {tournament.registeredPlayers.length}</p>
            <p>Статус: {tournament.status}</p>
            <p>Призовой фонд: {tournament.totalPrizePool} ₽</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTournamentDetail = () => {
    if (!selectedTournament) return null;

    const registeredPlayers = selectedTournament.registeredPlayers;
    const playersWithDetails = registeredPlayers.map(playerId => {
      const player = selectedTournament.players[playerId];
      return {
        id: playerId,
        name: player?.name || 'Неизвестный',
        stack: player?.stack || 0,
        seat: player?.seat,
        tableId: player?.tableId,
        rebuys: player?.rebuys || 0,
        addons: player?.addons || 0,
        eliminated: player?.eliminated || false,
        eliminationPlace: player?.eliminationPlace,
        eliminatedBy: player?.eliminatedBy
      };
    });

    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{selectedTournament.name}</h2>
          <button 
            onClick={() => setSelectedTournament(null)}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Назад
          </button>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-4">Управление турниром</h3>
          <div className="flex space-x-4">
            <button 
              onClick={() => handleSetStatus('inProgress')}
              disabled={selectedTournament.status !== 'registration'}
              className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              Начать турнир
            </button>
            
            <button 
              onClick={() => handleSetStatus('completed')}
              disabled={selectedTournament.status !== 'inProgress'}
              className="bg-red-500 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              Завершить турнир
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Игрок
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Стек
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Стол / Место
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ребай / Аддон
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {playersWithDetails.map((player) => (
                <tr key={player.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{player.name}</div>
                    <div className="text-sm text-gray-500">{player.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{player.stack}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {player.tableId ? `${player.tableId} / ${player.seat}` : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      Р: {player.rebuys}, А: {player.addons}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs ${
                      player.eliminated 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {player.eliminated ? 'Выбыл' : 'В игре'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {!player.eliminated && (
                      <>
                        <button 
                          onClick={() => {
                            const tableId = prompt('Введите ID стола:');
                            const seat = parseInt(prompt('Введите номер места:') || '0');
                            if (tableId && !isNaN(seat)) {
                              handleAssignSeat(player.id, tableId, seat);
                            }
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-2"
                        >
                          Назначить
                        </button>
                        
                        <button 
                          onClick={() => {
                            const eliminatedBy = prompt('Введите ID игрока, который выбил:');
                            if (eliminatedBy) {
                              handleEliminate(player.id, eliminatedBy);
                            }
                          }}
                          className="text-red-600 hover:text-red-900 mr-2"
                        >
                          Выбить
                        </button>
                        
                        <button 
                          onClick={() => handleRebuy(player.id)}
                          className="text-yellow-600 hover:text-yellow-900 mr-2"
                        >
                          Ребай
                        </button>
                        
                        <button 
                          onClick={() => handleAddAddon(player.id)}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          Аддон
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Панель администратора</h1>
            </div>
          </div>
        </div>
      </nav>

      {selectedTournament ? renderTournamentDetail() : renderTournamentList()}
    </div>
  );
};

export default AdminPanel;
