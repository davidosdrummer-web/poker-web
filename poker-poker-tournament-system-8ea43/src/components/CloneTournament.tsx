import { useState } from 'react';
import { actions } from '../lib/store';
import { makeT } from '../lib/i18n';
import { useApp } from '../lib/store';
import { Btn, Modal, Field, toast } from './ui';
import { uid } from '../lib/utils';
import type { Tournament } from '../lib/types';

interface CloneTournamentProps {
  tournament: Tournament;
  onCloned?: (newId: string) => void;
}

export function CloneTournament({ tournament, onCloned }: CloneTournamentProps) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState(`${tournament.name} (копия)`);

  const handleClone = () => {
    const newId = uid();
    
    const cloned: Partial<Tournament> = {
      ...tournament,
      id: newId,
      name: newName,
      date: Date.now() + 7 * 24 * 60 * 60 * 1000,
      status: 'scheduled',
      levelIndex: 0,
      levelEndsAt: null,
      pausedRemaining: null,
      entries: [],
      results: null,
      createdAt: Date.now(),
      levels: tournament.levels.map((l) => ({ ...l, id: uid() })),
      bonuses: tournament.bonuses.map((b) => ({ ...b, id: uid() })),
      tables: tournament.tables.map((t) => ({ ...t, id: uid() })),
    };

    const id = actions.createTournament(cloned);
    if (id && onCloned) {
      onCloned(id);
    }
    
    toast(t('tournamentCloned') || 'Турнир скопирован');
    setShowModal(false);
  };

  return (
    <>
      <Btn size="sm" variant="dark" icon="copy" onClick={() => setShowModal(true)}>
        {t('clone') || 'Копировать'}
      </Btn>

      {showModal && (
        <Modal
          title={t('cloneTournament') || 'Копирование турнира'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setShowModal(false)}>
                {t('cancel')}
              </Btn>
              <Btn variant="gold" icon="copy" onClick={handleClone}>
                {t('clone') || 'Копировать'}
              </Btn>
            </>
          }
        >
          <p className="text-sm text-cream-500 mb-4">
            {t('cloneHint') || 'Создать копию турнира со всеми настройками. Новая дата – через 7 дней.'}
          </p>
          <Field label={t('tournamentName')}>
            <input
              className="inp"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </Field>
        </Modal>
      )}
    </>
  );
}