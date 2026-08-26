import { useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import { makeT } from '../lib/i18n';
import { downloadFile, fullName, leaderboardRows } from '../lib/utils';
import { Avatar, Btn, EmptyState, Icon } from '../components/ui';

export function LeaderboardTab() {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [seasonId, setSeasonId] = useState<string | null>(null);

  const rows = useMemo(() => leaderboardRows(s.players, s.tournaments, seasonId), [s.players, s.tournaments, seasonId]);
  const season = seasonId ? s.seasons.find((x) => x.id === seasonId) : null;

  const csv = () => {
    const head = ['Rank', 'Player', 'Nickname', 'Points', 'Played', 'Wins', 'Top3', 'Finals', 'Best', 'AvgPoints', 'WinRate%'];
    const lines = rows.map((r, i) => {
      const p = s.players.find((x) => x.id === r.playerId);
      return [i + 1, p ? fullName(p) : r.playerId, p?.nickname ?? '', r.points, r.played, r.wins, r.top3, r.finals, r.best, r.played ? (r.points / r.played).toFixed(1) : 0, r.played ? Math.round((r.wins / r.played) * 100) : 0].join(';');
    });
    downloadFile(`rating-${season ? season.name : 'alltime'}.csv`, [head.join(';'), ...lines].join('\n'), 'text/csv');
  };

  return (
    <div className="anim-rise max-w-5xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-3xl text-cream-100">{t('leaderboard')}</h2>
          <p className="text-xs text-cream-500 mt-0.5 flex items-center gap-1.5"><Icon name="refresh" size={12} /> {t('recalculated')}</p>
        </div>
        <Btn icon="download" onClick={csv} disabled={rows.length === 0}>{t('exportCsv')}</Btn>
      </div>

      <div className="flex gap-1 bg-felt-900 border border-line rounded-lg p-1 w-fit mb-4 flex-wrap">
        <button onClick={() => setSeasonId(null)} className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors ${seasonId === null ? 'bg-gold-400 text-felt-950' : 'text-cream-500 hover:text-cream-100'}`}>
          {t('allTime')}
        </button>
        {s.seasons.map((x) => (
          <button key={x.id} onClick={() => setSeasonId(x.id)} className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors ${seasonId === x.id ? 'bg-gold-400 text-felt-950' : 'text-cream-500 hover:text-cream-100'}`}>
            {x.name}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card"><EmptyState icon="trophy" text={t('boardEmpty')} /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-cream-500 border-b border-line-soft">
                <th className="px-4 py-2.5 font-bold w-16">{t('place')}</th>
                <th className="px-3 py-2.5 font-bold">{t('nav.players')}</th>
                <th className="px-3 py-2.5 font-bold text-right">{t('totalPoints')}</th>
                <th className="px-3 py-2.5 font-bold text-right">{t('played')}</th>
                <th className="px-3 py-2.5 font-bold text-right">{t('wins')}</th>
                <th className="px-3 py-2.5 font-bold text-right">{t('top3')}</th>
                <th className="px-3 py-2.5 font-bold text-right">{t('finals')}</th>
                <th className="px-3 py-2.5 font-bold text-right">{t('best')}</th>
                <th className="px-3 py-2.5 font-bold text-right">{t('avgPoints')}</th>
                <th className="px-3 py-2.5 font-bold text-right">{t('winRate')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const p = s.players.find((x) => x.id === r.playerId);
                const medal = i === 0 ? 'text-gold-300' : i === 1 ? 'text-[#dbe2e8]' : i === 2 ? 'text-[#e0a86b]' : 'text-cream-500';
                return (
                  <tr key={r.playerId} className={`border-b border-line-soft/60 last:border-0 hover:bg-felt-800/40 transition-colors ${i < 3 ? 'bg-gold-400/4' : ''}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-display text-xl num ${medal}`}>{i + 1}</span>
                        {i < 3 && <Icon name={i === 0 ? 'crown' : 'trophy'} size={14} className={medal} filled />}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={p ? fullName(p) : '?'} color={p?.avatarColor ?? null} size={30} />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{p ? fullName(p) : r.playerId}</div>
                          {p?.nickname && <div className="text-[11px] text-cream-700">«{p.nickname}»</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-display text-xl num text-gold-300">{r.points}</td>
                    <td className="px-3 py-2.5 text-right num text-cream-300">{r.played}</td>
                    <td className="px-3 py-2.5 text-right num text-cream-300">{r.wins}</td>
                    <td className="px-3 py-2.5 text-right num text-cream-300">{r.top3}</td>
                    <td className="px-3 py-2.5 text-right num text-cream-300">{r.finals}</td>
                    <td className="px-3 py-2.5 text-right num text-cream-300">{r.best}</td>
                    <td className="px-3 py-2.5 text-right num text-cream-300">{r.played ? (r.points / r.played).toFixed(1) : '—'}</td>
                    <td className="px-3 py-2.5 text-right num text-cream-300">{r.played ? `${Math.round((r.wins / r.played) * 100)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
