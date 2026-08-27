import { useRef, useState } from 'react';
import { makeT } from '../lib/i18n';
import { useApp } from '../lib/store';
import { actions } from '../lib/store';
import { Btn, Icon, Modal, toast } from './ui';
import type { BlindLevel } from '../lib/types';
import { uid } from '../lib/utils';

interface StructureImportExportProps {
  tournamentId: string;
  onImport?: (levels: BlindLevel[]) => void;
}

export function StructureImportExport({ tournamentId, onImport }: StructureImportExportProps) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState('');

  const tournament = s.tournaments.find((x) => x.id === tournamentId);
  if (!tournament) return null;

  const handleExport = () => {
    const structure = {
      name: tournament.name,
      levels: tournament.levels,
      startingStack: tournament.startingStack,
      rebuyChips: tournament.rebuyChips,
      reentryChips: tournament.reentryChips,
      addonChips: tournament.addonChips,
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(structure, null, 2);
    setExportData(json);
    setShowExportModal(true);
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.levels || !Array.isArray(data.levels)) {
          throw new Error('Invalid structure');
        }
        
        const levels = data.levels.map((l: any) => ({
          ...l,
          id: uid(),
        }));
        
        if (onImport) {
          onImport(levels);
        } else {
          actions.loadStructure(tournamentId, levels);
        }
        
        toast(t('structureImported') || 'Структура импортирована');
      } catch {
        toast(t('invalidStructure') || 'Неверный формат файла', 'err');
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div className="flex gap-2">
        <Btn size="sm" icon="download" onClick={handleExport}>
          {t('exportStructure') || 'Экспорт'}
        </Btn>
        <Btn size="sm" icon="upload" onClick={() => fileRef.current?.click()}>
          {t('importStructure') || 'Импорт'}
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport(file);
            e.target.value = '';
          }}
        />
      </div>

      {showExportModal && (
        <Modal
          title={t('exportStructure') || 'Экспорт структуры'}
          onClose={() => setShowExportModal(false)}
          footer={
            <>
              <Btn
                variant="gold"
                icon="download"
                onClick={() => {
                  const blob = new Blob([exportData], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `structure-${tournament.name}-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                {t('download')}
              </Btn>
              <Btn variant="ghost" onClick={() => setShowExportModal(false)}>
                {t('close')}
              </Btn>
            </>
          }
        >
          <pre className="text-xs bg-felt-900 p-3 rounded-lg overflow-auto max-h-80 text-cream-300">
            {exportData}
          </pre>
        </Modal>
      )}
    </>
  );
}