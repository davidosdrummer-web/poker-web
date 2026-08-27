import type { AppState, BlindLevel, TournamentBonus } from './types';
import { uid } from './utils';

export function blindLevels(preset: 'classic' | 'turbo'): BlindLevel[] {
  const mk = (sb: number, bb: number, ante: number, duration: number): BlindLevel => ({
    id: uid(),
    sb,
    bb,
    ante,
    duration,
    isBreak: false,
  });
  const brk = (duration: number): BlindLevel => ({ id: uid(), sb: 0, bb: 0, ante: 0, duration, isBreak: true });
  if (preset === 'turbo') {
    return [
      mk(50, 100, 0, 8),
      mk(100, 200, 25, 8),
      mk(150, 300, 50, 8),
      mk(250, 500, 75, 8),
      brk(8),
      mk(400, 800, 100, 8),
      mk(600, 1200, 150, 8),
      mk(800, 1600, 200, 8),
      mk(1200, 2400, 300, 8),
      brk(8),
      mk(1600, 3200, 400, 8),
      mk(2400, 4800, 600, 8),
      mk(3200, 6400, 800, 8),
      mk(4800, 9600, 1200, 8),
      mk(6400, 12800, 1600, 8),
    ];
  }
  return [
    mk(25, 50, 0, 12),
    mk(50, 100, 0, 12),
    mk(75, 150, 25, 12),
    mk(100, 200, 25, 12),
    brk(10),
    mk(150, 300, 50, 15),
    mk(200, 400, 50, 15),
    mk(300, 600, 75, 15),
    mk(400, 800, 100, 15),
    brk(10),
    mk(500, 1000, 100, 20),
    mk(600, 1200, 150, 20),
    mk(800, 1600, 200, 20),
    mk(1000, 2000, 250, 20),
    brk(10),
    mk(1500, 3000, 300, 20),
    mk(2000, 4000, 400, 20),
    mk(3000, 6000, 500, 20),
    mk(5000, 10000, 1000, 20),
  ];
}

export function defaultBonuses(): TournamentBonus[] {
  return [
    { id: uid(), name: 'Кальян', chips: 2000 },
    { id: uid(), name: 'Топ-пара', chips: 1000 },
    { id: uid(), name: 'Пунктуальность', chips: 1500 },
    { id: uid(), name: 'День рождения', chips: 5000 },
  ];
}

export function seedState(): AppState {
  return {
    rev: 1,
    savedAt: Date.now(),
    activeTournamentId: null,
    settings: {
      clubName: 'БЛАЙНД',
      clubShort: 'БЛ',
      accent: '#f2c14e',
      language: 'ru',
      sound: 'bell',
      sfx: true,
      sfxEvents: { start: true, eliminate: true, level: true, break: true, rebuy: true, reentry: true, addon: true, end: true },
      role: 'admin',
      screens: {
        showTimer: true,
        showBlinds: true,
        showStats: true,
        showTicker: true,
        boardSeasonId: null,
      },
      tournamentTemplates: [],
      pointsTemplate: [
        { place: 1, points: 50 },
        { place: 2, points: 35 },
        { place: 3, points: 25 },
        { place: 4, points: 20 },
        { place: 5, points: 15 },
        { place: 6, points: 12 },
        { place: 7, points: 10 },
        { place: 8, points: 8 },
        { place: 9, points: 6 },
      ],
      participationTemplate: 5,
      rebuyPenaltyTemplate: 0,
      addonPenaltyTemplate: 0,
    },
    players: [],
    seasons: [],
    tournaments: [],
    ticker: [],
  };
}