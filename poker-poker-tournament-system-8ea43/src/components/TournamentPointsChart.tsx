import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useApp } from '../lib/store';
import { makeT } from '../lib/i18n';
import { fullName } from '../lib/utils';
import type { Tournament } from '../lib/types';
import { Icon } from './ui';

interface TournamentPointsChartProps {
  tournament: Tournament;
  height?: number;
}

export function TournamentPointsChart({ tournament, height = 250 }: TournamentPointsChartProps) {
  const s = useApp();
  const t = makeT(s.settings.language);

  const data = useMemo(() => {
    if (!tournament.results) return [];
    return tournament.results
      .sort((a, b) => a.place - b.place)
      .slice(0, 10)
      .map((r) => {
        const player = s.players.find((p) => p.id === r.playerId);
        return {
          name: player ? fullName(player) : r.playerId,
          points: r.points,
          place: r.place,
          isWinner: r.place === 1,
          isTop3: r.place <= 3,
        };
      });
  }, [tournament, s.players]);

  if (data.length === 0) {
    return (
      <div className="text-center py-6 text-cream-500">
        <Icon name="trophy" size={24} className="mx-auto opacity-40" />
        <p className="mt-1 text-sm">{t('noData') || 'Нет данных'}</p>
      </div>
    );
  }

  const getColor = (entry: typeof data[0]) => {
    if (entry.isWinner) return '#f2c14e';
    if (entry.isTop3) return '#dbe2e8';
    return '#4cc38a';
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2e4a37" />
          <XAxis dataKey="name" tick={{ fill: '#a49f8c', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
          <YAxis label={{ value: t('points') || 'Очки', angle: -90, position: 'insideLeft', fill: '#a49f8c', fontSize: 11 }} tick={{ fill: '#a49f8c', fontSize: 10 }} />
          <Tooltip contentStyle={{ backgroundColor: '#0e1811', borderColor: '#1d2e23', borderRadius: '8px', color: '#f4eedd' }} labelStyle={{ color: '#f2c14e' }} formatter={(value: number) => [`${value} ${t('pts')}`, 'Очки']} />
          <Bar dataKey="points" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}