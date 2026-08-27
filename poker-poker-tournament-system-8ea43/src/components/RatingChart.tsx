import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, Legend } from 'recharts';
import { useApp } from '../lib/store';
import { makeT } from '../lib/i18n';
import { fmtDate } from '../lib/utils';
import { Icon, Badge } from './ui';

interface RatingChartProps {
  playerId: string;
  height?: number;
  showHistory?: boolean;
}

export function RatingChart({ playerId, height = 300, showHistory = true }: RatingChartProps) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const player = s.players.find((p) => p.id === playerId);

  const data = useMemo(() => {
    if (!player) return [];
    const tournaments = s.tournaments
      .filter((tor) => tor.status === 'finished' && tor.entries.some((e) => e.playerId === playerId))
      .sort((a, b) => a.date - b.date);
    if (tournaments.length === 0) return [];
    let cumulativePoints = player.basePoints || 0;
    return tournaments.map((tor, index) => {
      const entry = tor.entries.find((e) => e.playerId === playerId);
      const points = entry?.points || 0;
      const place = entry?.place || null;
      cumulativePoints += points;
      return {
        index: index + 1,
        tournamentId: tor.id,
        tournamentName: tor.name,
        date: tor.date,
        points: points,
        cumulativePoints: cumulativePoints,
        place: place,
        formattedDate: fmtDate(tor.date, s.settings.language),
      };
    });
  }, [s.players, s.tournaments, playerId]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const points = data.map((d) => d.points);
    const maxPoints = Math.max(...points);
    const avgPoints = Math.round(points.reduce((a, b) => a + b, 0) / points.length);
    const totalPoints = data[data.length - 1]?.cumulativePoints || 0;
    return { maxPoints, avgPoints, totalPoints, tournaments: data.length, bestPlace: Math.min(...data.map((d) => d.place).filter((p) => p !== null)) };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-cream-500">
        <Icon name="trophy" size={32} className="mx-auto opacity-40" />
        <p className="mt-2 text-sm">{t('noHistory') || 'Нет завершённых турниров'}</p>
      </div>
    );
  }

  const chartData = showHistory ? data : data.slice(-10);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="card p-3 text-center">
          <div className="text-[10px] uppercase text-cream-500">{t('played')}</div>
          <div className="font-display text-xl text-cream-100">{stats?.tournaments}</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-[10px] uppercase text-cream-500">{t('totalPoints')}</div>
          <div className="font-display text-xl text-gold-300">{stats?.totalPoints}</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-[10px] uppercase text-cream-500">{t('avgPoints')}</div>
          <div className="font-display text-xl text-cream-100">{stats?.avgPoints}</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-[10px] uppercase text-cream-500">{t('best')}</div>
          <div className="font-display text-xl text-win">#{stats?.bestPlace}</div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-display text-lg text-gold-300">{t('ratingDynamics') || 'Динамика рейтинга'}</span>
          <Badge tone="info">{data.length} {t('tournaments')}</Badge>
        </div>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2e4a37" />
            <XAxis dataKey="index" label={{ value: t('tournamentNumber') || 'Турнир №', position: 'insideBottom', offset: -5, fill: '#a49f8c', fontSize: 11 }} tick={{ fill: '#a49f8c', fontSize: 10 }} />
            <YAxis yAxisId="left" label={{ value: t('points') || 'Очки', angle: -90, position: 'insideLeft', fill: '#a49f8c', fontSize: 11 }} tick={{ fill: '#a49f8c', fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" label={{ value: t('place') || 'Место', angle: 90, position: 'insideRight', fill: '#a49f8c', fontSize: 11 }} reversed domain={[1, 'dataMax + 1']} tick={{ fill: '#a49f8c', fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: '#0e1811', borderColor: '#1d2e23', borderRadius: '8px', color: '#f4eedd' }} labelStyle={{ color: '#f2c14e' }} formatter={(value: number, name: string) => { if (name === 'points') return [`${value} очков`, 'Очки']; if (name === 'cumulativePoints') return [`${value} очков`, 'Суммарно']; if (name === 'place') return [`#${value}`, 'Место']; return [value, name]; }} labelFormatter={(label) => `Турнир ${label}`} />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="cumulativePoints" stroke="#f2c14e" strokeWidth={2} dot={{ r: 4, fill: '#f2c14e', strokeWidth: 2, stroke: '#0e1811' }} activeDot={{ r: 6 }} name={t('totalPoints') || 'Суммарные очки'} />
            <Bar yAxisId="left" dataKey="points" fill="#4cc38a" opacity={0.5} name={t('points') || 'Очки за турнир'} />
            <Line yAxisId="right" type="monotone" dataKey="place" stroke="#e0564f" strokeWidth={2} dot={{ r: 4, fill: '#e0564f', strokeWidth: 2, stroke: '#0e1811' }} activeDot={{ r: 6 }} name={t('place') || 'Место'} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-cream-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-gold-400" />{t('totalPoints') || 'Суммарные очки'}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-win/50" />{t('points') || 'Очки за турнир'}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-loss" />{t('place') || 'Место'}</span>
        </div>
      </div>

      {showHistory && (
        <div className="card p-4">
          <h4 className="font-display text-md text-gold-300 mb-2">{t('historyTable') || 'История турниров'}</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-cream-500 border-b border-line-soft">
                  <th className="px-2 py-1.5 font-bold">#</th>
                  <th className="px-2 py-1.5 font-bold">{t('tournamentName')}</th>
                  <th className="px-2 py-1.5 font-bold text-right">{t('place')}</th>
                  <th className="px-2 py-1.5 font-bold text-right">{t('points')}</th>
                  <th className="px-2 py-1.5 font-bold text-right">{t('totalPoints')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={i} className="border-b border-line-soft/60 last:border-0 hover:bg-felt-800/40">
                    <td className="px-2 py-1.5 num text-cream-500">{i + 1}</td>
                    <td className="px-2 py-1.5 font-semibold truncate max-w-[120px]">{d.tournamentName}</td>
                    <td className="px-2 py-1.5 text-right num">
                      <span className={d.place === 1 ? 'text-gold-300' : d.place === 2 ? 'text-[#dbe2e8]' : d.place === 3 ? 'text-[#e0a86b]' : 'text-cream-500'}>
                        {d.place ? `#${d.place}` : '—'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right num text-win">+{d.points}</td>
                    <td className="px-2 py-1.5 text-right num text-gold-300">{d.cumulativePoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}