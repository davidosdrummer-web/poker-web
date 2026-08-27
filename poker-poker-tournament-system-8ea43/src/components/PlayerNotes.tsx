import { useState } from 'react';
import { actions, useApp } from '../lib/store';
import { makeT } from '../lib/i18n';
import { Icon, Btn, toast } from './ui';
import type { Player } from '../lib/types';

interface PlayerNotesProps {
  player: Player;
  editable?: boolean;
}

export function PlayerNotes({ player, editable = true }: PlayerNotesProps) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [notes, setNotes] = useState(player.notes || '');
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    actions.updatePlayer(player.id, { notes });
    toast(t('notesSaved') || 'Заметки сохранены');
    setIsEditing(false);
  };

  if (!editable && !player.notes) return null;

  return (
    <div className="border border-line-soft rounded-lg p-3 bg-felt-900/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-cream-500 flex items-center gap-2">
          <Icon name="edit" size={14} />
          {t('notes') || 'Заметки'}
        </span>
        {editable && (
          <Btn
            size="sm"
            variant="ghost"
            icon={isEditing ? 'x' : 'edit'}
            onClick={() => isEditing ? setIsEditing(false) : setIsEditing(true)}
          >
            {isEditing ? t('cancel') : t('edit')}
          </Btn>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            className="inp min-h-[80px] resize-y"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('notesPlaceholder') || 'Введите заметки об игроке...'}
          />
          <Btn size="sm" variant="gold" icon="check" onClick={handleSave}>
            {t('save')}
          </Btn>
        </div>
      ) : (
        <div className="text-sm text-cream-300 whitespace-pre-wrap min-h-[40px]">
          {notes || (
            <span className="text-cream-500 italic">
              {t('noNotes') || 'Заметки отсутствуют'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}