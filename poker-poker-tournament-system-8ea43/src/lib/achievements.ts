import type { Player, Tournament } from './types';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
}

export function getPlayerAchievements(player: Player, tournaments: Tournament[]): Achievement[] {
  const stats = getPlayerStats(player.id, tournaments);
  const achievements: Achievement[] = [];

  achievements.push({
    id: 'first-tournament',
    name: 'Первый турнир',
    description: 'Сыграть свой первый турнир',
    icon: 'trophy',
    unlocked: stats.played >= 1,
  });

  achievements.push({
    id: 'ten-tournaments',
    name: 'Ветеран',
    description: 'Сыграть 10 турниров',
    icon: 'trophy',
    unlocked: stats.played >= 10,
    progress: Math.min(stats.played, 10),
    target: 10,
  });

  achievements.push({
    id: 'first-win',
    name: 'Победитель',
    description: 'Выиграть свой первый турнир',
    icon: 'crown',
    unlocked: stats.wins >= 1,
  });

  achievements.push({
    id: 'top-three',
    name: 'Топ-3',
    description: 'Попасть в топ-3 турнира',
    icon: 'hand',
    unlocked: stats.top3 >= 1,
  });

  achievements.push({
    id: 'chip-leader',
    name: 'Чиплидер',
    description: 'Закончить турнир с наибольшим стеком',
    icon: 'blinds',
    unlocked: stats.chipLeaderCount >= 1,
  });

  achievements.push({
    id: 'five-wins',
    name: 'Мастер',
    description: 'Одержать 5 побед в турнирах',
    icon: 'crown',
    unlocked: stats.wins >= 5,
    progress: Math.min(stats.wins, 5),
    target: 5,
  });

  achievements.push({
    id: 'hundred-points',
    name: 'Сотня',
    description: 'Набрать 100 очков в рейтинге',
    icon: 'spade',
    unlocked: stats.totalPoints >= 100,
    progress: Math.min(stats.totalPoints, 100),
    target: 100,
  });

  achievements.push({
    id: 'knockout-king',
    name: 'Нокаутер',
    description: 'Выбить 10 игроков за всё время',
    icon: 'bolt',
    unlocked: stats.knockouts >= 10,
    progress: Math.min(stats.knockouts, 10),
    target: 10,
  });

  return achievements;
}

function getPlayerStats(playerId: string, tournaments: Tournament[]) {
  let played = 0;
  let wins = 0;
  let top3 = 0;
  let totalPoints = 0;
  let knockouts = 0;
  let chipLeaderCount = 0;

  for (const tor of tournaments) {
    if (tor.status !== 'finished') continue;
    const entry = tor.entries.find((e) => e.playerId === playerId);
    if (!entry || entry.place == null) continue;

    played++;
    totalPoints += entry.points || 0;
    if (entry.place === 1) wins++;
    if (entry.place <= 3) top3++;
    knockouts += entry.knockouts || 0;

    const maxStack = Math.max(...tor.entries.map((e) => e.stack));
    if (entry.stack === maxStack) chipLeaderCount++;
  }

  return { played, wins, top3, totalPoints, knockouts, chipLeaderCount };
}