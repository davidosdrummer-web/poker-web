import { makeT } from '../lib/i18n';
import { useApp } from '../lib/store';

type Period = 'all' | 'month' | 'week' | 'year';

interface PeriodFilterProps {
  value: Period;
  onChange: (period: Period) => void;
}

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const s = useApp();
  const t = makeT(s.settings.language);

  const periods: { id: Period; label: string }[] = [
    { id: 'all', label: t('allTime') || 'Всё время' },
    { id: 'year', label: t('thisYear') || 'Этот год' },
    { id: 'month', label: t('thisMonth') || 'Этот месяц' },
    { id: 'week', label: t('thisWeek') || 'Эта неделя' },
  ];

  return (
    <div className="flex gap-1 bg-felt-900 border border-line rounded-lg p-1 flex-wrap">
      {periods.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors ${
            value === p.id
              ? 'bg-gold-400 text-felt-950'
              : 'text-cream-500 hover:text-cream-100'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}