import { useMemo } from 'react';
import { useApp } from '../lib/store';
import { makeT } from '../lib/i18n';
import { getPlayerAchievements } from '../lib/achievements';
import { Icon, Badge } from './ui';
import type { Player } from '../lib/types';

interface AchievementsProps {
  player: Player;
}

export function Achievements({ player }: AchievementsProps) {
  const s = useApp();
  const t = makeT(s.settings.language);

  const achievements = useMemo(
    () => getPlayerAchievements(player, s.tournaments),
    [player, s.tournaments]
  );

  const unlocked = achievements.filter((a) => a.unlocked);
  const total = achievements.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-gold-300 flex items-center gap-2">
          <Icon name="crown" size={18} />
          {t('achievements') || 'Достижения'}
        </h3>
        <Badge tone="gold">
          {unlocked.length}/{total}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {achievements.map((ach) => (
          <div
            key={ach.id}
            className={`card p-3 text-center transition-all ${
              ach.unlocked
                ? 'border-gold-400/40 bg-gold-400/5'
                : 'opacity-40 grayscale'
            }`}
          >
            <div
              className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
                ach.unlocked
                  ? 'bg-gold-400/15 text-gold-300'
                  : 'bg-felt-750 text-cream-500'
              }`}
            >
              <Icon name={ach.icon} size={24} />
            </div>
            <div className="mt-1.5 font-semibold text-sm text-cream-100">
              {ach.name}
            </div>
            <div className="text-[10px] text-cream-500 line-clamp-2">
              {ach.description}
            </div>
            {ach.progress !== undefined && ach.target !== undefined && (
              <div className="mt-1">
                <div className="w-full h-1 bg-felt-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((ach.progress / ach.target) * 100, 100)}%`,
                    }}
                  />
                </div>
                <div className="text-[9px] text-cream-500 mt-0.5">
                  {ach.progress}/{ach.target}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}