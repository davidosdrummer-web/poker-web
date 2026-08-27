import React, { useEffect, useMemo, useState, type DragEvent } from 'react';
import type { AppState, GameType, Tournament, TournamentTemplate } from '../lib/types';
import { actions, balanceSuggestions, can, getState, regClosed, useApp } from '../lib/store';
import { makeT, type TFunc } from '../lib/i18n';
import { blindLevels } from '../lib/data';
import { autoSeatPlan, entryPoints, fmtChips, fmtClock, fmtDate, fmtDateTime, fmtInt, fmtTimeOfDay, fullName, leaderboardRows, seatPositions, uid } from '../lib/utils';
import { Avatar, Badge, Btn, EmptyState, Field, Icon, Modal, Toggle, toast } from '../components/ui';
import { CloneTournament } from '../components/CloneTournament';
import { StructureImportExport } from '../components/StructureImportExport';
import { TournamentPointsChart } from '../components/TournamentPointsChart';

function toLocalInput(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function HMSInput({ seconds, onChange, disabled }: { seconds: number; onChange: (sec: number) => void; disabled?: boolean }) {
  const fmt = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s2 = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s2).padStart(2, '0')}`;
  };
  const [val, setVal] = useState(fmt(seconds));
  useEffect(() => setVal(fmt(seconds)), [seconds]);
  const commitVal = () => {
    const parts = val.split(':').map((x) => parseInt(x.trim(), 10));
    const h = Number.isFinite(parts[0]) ? Math.max(0, Math.min(99, parts[0])) : 0;
    const m = Number.isFinite(parts[1]) ? Math.max(0, Math.min(59, parts[1])) : 0;
    const s2 = Number.isFinite(parts[2]) ? Math.max(0, Math.min(59, parts[2])) : 0;
    onChange(h * 3600 + m * 60 + s2);
    setVal(fmt(h * 3600 + m * 60 + s2));
  };
  return (
    <input
      className="inp num !w-28 !text-center tracking-[0.2em]"
      value={val}
      disabled={disabled}
      placeholder="чч:мм:сс"
      onChange={(e) => setVal(e.target.value.replace(/[^\d:]/g, '').slice(0, 8))}
      onBlur={commitVal}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}

export function TournamentsTab({ editorId, section, onOpenEditor, onCloseEditor, onGoLive }: {
  editorId: string | null;
  section: string;
  onOpenEditor: (id: string, section?: string) => void;
  onCloseEditor: () => void;
  onGoLive: () => void;
}) {
  const s = useApp();
  const editing = editorId ? s.tournaments.find((t) => t.id === editorId) ?? null : null;
  if (editing) {
    return <TournamentEditor tor={editing} section={section} onBack={onCloseEditor} onGoLive={onGoLive} onSection={(sec) => onOpenEditor(editing.id, sec)} />;
  }
  return <TournamentList onOpenEditor={onOpenEditor} onGoLive={onGoLive} />;
}

/* ================= LIST ================= */

function TournamentList({ onOpenEditor, onGoLive }: { onOpenEditor: (id: string, section?: string) => void; onGoLive: () => void }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [delId, setDelId] = useState<string | null>(null);
  const live = s.tournaments.filter((x) => x.status === 'running' || x.status === 'paused' || x.status === 'break');
  const upcoming = s.tournaments.filter((x) => x.status === 'scheduled' || x.status === 'registration').sort((a, b) => a.date - b.date);
  const past = s.tournaments.filter((x) => x.status === 'finished').sort((a, b) => b.date - a.date);
  const structure = can('structure');

  const row = (tor: Tournament, highlight = false) => {
    const season = tor.seasonId ? s.seasons.find((x) => x.id === tor.seasonId) : null;
    const winner = tor.results?.find((r) => r.place === 1);
    const winnerName = winner ? s.players.find((p) => p.id === winner.playerId) : null;
    const isActive = s.activeTournamentId === tor.id;
    return (
      <div key={tor.id} className={`card p-4 flex items-center gap-4 flex-wrap transition-all duration-300 hover:border-felt-600 hover:shadow-lg hover:scale-[1.01] ${highlight ? 'border-gold-400/40' : ''} ${isActive ? 'border-gold-400/30' : ''}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-xl text-cream-100 truncate">{tor.name}</span>
            <StatusBadge tor={tor} t={t} />
            {isActive && <Badge tone="gold">{t('active')}</Badge>}
          </div>
          <div className="text-xs text-cream-500 mt-1 flex items-center gap-3 flex-wrap num">
            <span className="flex items-center gap-1"><Icon name="timer" size={12} /> {fmtDateTime(tor.date, s.settings.language)}</span>
            <span className="flex items-center gap-1"><Icon name="users" size={12} /> {tor.entries.length}</span>
            {season && <span className="flex items-center gap-1"><Icon name="trophy" size={12} /> {season.name}</span>}
            {winnerName && <span className="flex items-center gap-1 text-gold-300"><Icon name="crown" size={12} /> {fullName(winnerName)} (+{winner?.points} {t('pts')})</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {tor.status !== 'finished' && (
            <Btn size="sm" variant={isActive ? 'gold' : 'dark'} icon="play" onClick={() => { actions.setActive(tor.id); onGoLive(); }}>
              {t('openLive')}
            </Btn>
          )}
          <Btn size="sm" variant="ghost" icon="edit" onClick={() => onOpenEditor(tor.id, tor.status === 'finished' ? 'results' : 'params')}>
            {t('edit')}
          </Btn>
          {structure && (
            <>
              <CloneTournament tournament={tor} onCloned={(id) => onOpenEditor(id, 'params')} />
              <Btn size="sm" variant="ghost" icon="trash" onClick={() => setDelId(tor.id)} />
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="anim-rise max-w-5xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-3xl text-cream-100">{t('tournaments')}</h2>
          <p className="text-xs text-cream-500 mt-0.5 num">{s.tournaments.length} · {t('recalculated')}</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {structure && (
            <TemplateField
              templates={s.settings.tournamentTemplates}
              onDelete={(id) => { actions.deleteTemplate(id); toast(t('templateDeleted'), 'warn'); }}
              onPick={(tpl) => {
                const id = actions.createTournament({
                  gameType: tpl.gameType,
                  startingStack: tpl.startingStack,
                  levels: tpl.levels.map((l) => ({ ...l, id: uid() })),
                  pointsGrid: tpl.pointsGrid,
                  participationPoints: tpl.participationPoints,
                  rebuyPenalty: tpl.rebuyPenalty,
                  addonPenalty: tpl.addonPenalty,
                  rebuyChips: tpl.rebuyChips,
                  reentryChips: tpl.reentryChips,
                  addonChips: tpl.addonChips,
                  bonuses: tpl.bonuses.map((b) => ({ ...b, id: uid() })),
                  knockoutPointsEnabled: tpl.knockoutPointsEnabled,
                  knockoutPoints: tpl.knockoutPoints,
                  registrationClosesAt: tpl.regWindowSec != null ? Date.now() + tpl.regWindowSec * 1000 : null,
                  rebuyClosesAt: tpl.rebuyWindowSec != null ? Date.now() + tpl.rebuyWindowSec * 1000 : null,
                });
                if (getState().tournaments.some((x) => x.id === id)) {
                  onOpenEditor(id, 'params');
                  toast(`${t('fromTemplate')}: ${tpl.name}`);
                }
              }}
            />
          )}
          <Btn variant="gold" size="lg" icon="plus" disabled={!structure} onClick={() => {
            const id = actions.createTournament({});
            if (getState().tournaments.some((x) => x.id === id)) {
              onOpenEditor(id, 'params');
              toast(t('createTournament'));
            } else {
              toast(t('noAccess'), 'err');
            }
          }}>
            {t('createTournament')}
          </Btn>
          {!structure && <span className="text-xs text-loss font-semibold flex items-center gap-1.5"><Icon name="info" size={13} /> {t('noAccess')}</span>}
        </div>
      </div>

      {live.length > 0 && (
        <Section title={t('liveNow')} tone="text-win">
          {live.map((x) => row(x, true))}
        </Section>
      )}
      <Section title={t('scheduled')} tone="text-info">
        {upcoming.map((x) => row(x))}
        {upcoming.length === 0 && <EmptyState icon="timer" text={t('empty')} />}
      </Section>
      <Section title={t('pastTournaments')} tone="text-cream-500">
        {past.map((x) => row(x))}
        {past.length === 0 && <EmptyState icon="trophy" text={t('empty')} />}
      </Section>

      {delId && (
        <Modal title={t('deleteTournament')} onClose={() => setDelId(null)} footer={
          <>
            <Btn variant="ghost" onClick={() => setDelId(null)}>{t('cancel')}</Btn>
            <Btn variant="danger" icon="trash" onClick={() => { actions.deleteTournament(delId); setDelId(null); toast(t('delete'), 'warn'); }}>{t('delete')}</Btn>
          </>
        }>
          <p className="text-sm text-cream-300">{t('confirmDeleteT')}</p>
        </Modal>
      )}
    </div>
  );
}

function Section({ title, tone, children }: { title: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className={`font-display text-lg uppercase tracking-wider mb-2.5 ${tone}`}>{title}</h3>
      <div className="flex flex-col gap-2.5">
        {React.Children.map(children, (child, index) => (
          <div className="anim-slide-right" style={{ animationDelay: `${index * 50}ms` }}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateField({ templates, onPick, onDelete }: {
  templates: TournamentTemplate[];
  onPick: (tpl: TournamentTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [selected, setSelected] = useState('');
  const chosen = templates.find((x) => x.id === selected);
  return (
    <div className="flex items-center gap-1.5">
      <label className="flex flex-col">
        <span className="text-[9px] uppercase tracking-[0.16em] text-cream-700 font-bold mb-1">{t('fromTemplate')}</span>
        <div className="flex items-center gap-1.5">
          <select
            className="inp !py-2.5 min-w-[210px]"
            value={selected}
            onChange={(e) => {
              const id = e.target.value;
              setSelected(id);
              const tpl = templates.find((x) => x.id === id);
              if (tpl) {
                onPick(tpl);
                setSelected('');
              }
            }}
          >
            <option value="">{t('noTemplates') === t('fromTemplate') ? '' : '—'} {t('createTournament').toLowerCase()}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} · {tpl.levels.filter((l) => !l.isBreak).length} {t('level').toLowerCase()} · {fmtChips(tpl.startingStack)}
              </option>
            ))}
          </select>
          {chosen && (
            <button
              className="p-2.5 rounded-lg border border-line-soft text-cream-500 hover:text-loss hover:bg-loss/10 hover:border-loss/40 transition-colors"
              title={`${t('delete')}: ${chosen.name}`}
              onClick={() => { onDelete(chosen.id); setSelected(''); }}
            >
              <Icon name="trash" size={15} />
            </button>
          )}
        </div>
      </label>
    </div>
  );
}

export function StatusBadge({ tor, t }: { tor: Tournament; t: TFunc }) {
  const map: Record<Tournament['status'], { label: string; tone: 'gold' | 'green' | 'red' | 'info' | 'neutral' }> = {
    scheduled: { label: t('status.scheduled'), tone: 'neutral' },
    registration: { label: t('status.registration'), tone: 'info' },
    running: { label: t('status.running'), tone: 'green' },
    paused: { label: t('status.paused'), tone: 'red' },
    break: { label: t('status.break'), tone: 'gold' },
    finished: { label: t('status.finished'), tone: 'neutral' },
  };
  const m = map[tor.status];
  return (
    <Badge tone={m.tone}>
      {tor.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-win anim-pulse-soft" />}
      {m.label}
    </Badge>
  );
}

/* ================= EDITOR ================= */

type Sec = 'params' | 'registration' | 'structure' | 'bonuses' | 'points' | 'tables' | 'results';

function TournamentEditor({ tor, section, onBack, onGoLive, onSection }: { tor: Tournament; section: string; onBack: () => void; onGoLive: () => void; onSection: (s: string) => void }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const sec: Sec = (['params', 'registration', 'structure', 'bonuses', 'points', 'tables', 'results'] as Sec[]).includes(section as Sec) ? (section as Sec) : 'params';
  const structure = can('structure');
  const liveOk = can('live');
  const [delOpen, setDelOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplName, setTplName] = useState('');

  const saveAsTemplate = () => {
    actions.saveTemplate({
      id: uid(),
      name: tplName.trim() || tor.name,
      createdAt: Date.now(),
      gameType: tor.gameType,
      startingStack: tor.startingStack,
      levels: tor.levels,
      pointsGrid: tor.pointsGrid,
      participationPoints: tor.participationPoints,
      rebuyPenalty: tor.rebuyPenalty,
      addonPenalty: tor.addonPenalty,
      rebuyChips: tor.rebuyChips,
      reentryChips: tor.reentryChips,
      addonChips: tor.addonChips,
      bonuses: tor.bonuses,
      knockoutPointsEnabled: tor.knockoutPointsEnabled,
      knockoutPoints: tor.knockoutPoints,
      regWindowSec: tor.registrationClosesAt != null ? Math.max(0, Math.round((tor.registrationClosesAt - tor.date) / 1000)) : null,
      rebuyWindowSec: tor.rebuyClosesAt != null ? Math.max(0, Math.round((tor.rebuyClosesAt - tor.date) / 1000)) : null,
    });
    setTplOpen(false);
    setTplName('');
    toast(t('templateSaved'));
  };

  const tabs: { id: Sec; label: string; icon: string; show: boolean }[] = [
    { id: 'params', label: t('sec.params'), icon: 'settings', show: true },
    { id: 'registration', label: `${t('sec.registration')} · ${tor.entries.length}`, icon: 'users', show: true },
    { id: 'structure', label: t('sec.structure'), icon: 'blinds', show: true },
    { id: 'bonuses', label: `${t('bonusesSection')} · ${tor.bonuses.length}`, icon: 'bell', show: true },
    { id: 'points', label: t('sec.points'), icon: 'trophy', show: true },
    { id: 'tables', label: t('sec.tables'), icon: 'table', show: true },
    { id: 'results', label: t('sec.results'), icon: 'crown', show: tor.status === 'finished' },
  ];

  return (
    <div className="anim-rise">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Btn variant="ghost" icon="up" onClick={onBack} className="!rotate-0"><span className="sr-only">back</span>{t('backToList')}</Btn>
        <h2 className="font-display text-2xl text-cream-100 truncate">{tor.name}</h2>
        <StatusBadge tor={tor} t={t} />
        <span className="text-xs text-cream-500 num">{fmtDateTime(tor.date, s.settings.language)}</span>
        <div className="flex-1" />
        {structure && (
          <>
            <Btn variant="dark" icon="download" onClick={() => setTplOpen(true)}>{t('saveTemplate')}</Btn>
            <StructureImportExport tournamentId={tor.id} />
          </>
        )}
        {structure && (
          <Btn variant="ghost" icon="trash" onClick={() => setDelOpen(true)}>{t('delete')}</Btn>
        )}
        {tor.status !== 'finished' && (
          <Btn variant="gold" icon="play" onClick={() => { actions.setActive(tor.id); onGoLive(); }}>{t('openLive')}</Btn>
        )}
      </div>

      {tplOpen && (
        <Modal title={t('saveTemplate')} onClose={() => setTplOpen(false)} footer={
          <>
            <Btn variant="ghost" onClick={() => setTplOpen(false)}>{t('cancel')}</Btn>
            <Btn variant="gold" icon="check" onClick={saveAsTemplate}>{t('save')}</Btn>
          </>
        }>
          <p className="text-[11px] text-cream-500 mb-3 flex items-center gap-2"><Icon name="info" size={13} /> {t('templatesHint')}</p>
          <Field label={t('templateName')}>
            <input className="inp" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder={tor.name} onKeyDown={(e) => e.key === 'Enter' && saveAsTemplate()} autoFocus />
          </Field>
        </Modal>
      )}
      {delOpen && (
        <Modal title={t('deleteTournament')} onClose={() => setDelOpen(false)} footer={
          <>
            <Btn variant="ghost" onClick={() => setDelOpen(false)}>{t('cancel')}</Btn>
            <Btn variant="danger" icon="trash" onClick={() => { actions.deleteTournament(tor.id); toast(t('delete'), 'warn'); onBack(); }}>{t('delete')}</Btn>
          </>
        }>
          <p className="text-sm text-cream-300">{t('confirmDeleteT')}</p>
        </Modal>
      )}

      <div className="flex gap-1 mb-4 bg-felt-900 border border-line rounded-lg p-1 w-fit max-w-full overflow-x-auto">
        {tabs.filter((x) => x.show).map((x) => (
          <button key={x.id} onClick={() => onSection(x.id)} className={`px-3.5 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${sec === x.id ? 'bg-gold-400 text-felt-950' : 'text-cream-500 hover:text-cream-100'}`}>
            <Icon name={x.icon} size={14} /> {x.label}
          </button>
        ))}
      </div>

      {sec === 'params' && <ParamsSection tor={tor} editable={structure} />}
      {sec === 'registration' && <RegistrationSection tor={tor} editable={liveOk && !regClosed(tor) && tor.status !== 'finished'} />}
      {sec === 'structure' && <StructureSection tor={tor} editable={structure} />}
      {sec === 'bonuses' && <BonusesSection tor={tor} editable={structure} />}
      {sec === 'points' && <PointsSection tor={tor} editable={structure && (tor.status === 'scheduled' || tor.status === 'registration')} />}
      {sec === 'tables' && <SeatingSection tor={tor} editable={liveOk} />}
      {sec === 'results' && <ResultsSection tor={tor} />}
    </div>
  );
}

function StartDateTimeField({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (ts: number) => void }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const setTime = (hm: string) => {
    const [h, m] = hm.split(':').map(Number);
    const nd = new Date(value);
    nd.setHours(h, m, 0, 0);
    onChange(nd.getTime());
  };
  const setDate = (ds: string) => {
    const nd = new Date(`${ds}T${timeStr}:00`);
    if (!Number.isNaN(nd.getTime())) onChange(nd.getTime());
  };
  const dayStart = (offset: number) => {
    const nd = new Date();
    nd.setHours(0, 0, 0, 0);
    nd.setDate(nd.getDate() + offset);
    return nd.getTime();
  };
  const presets = [
    { label: t('dateToday'), ts: dayStart(0) },
    { label: t('dateTomorrow'), ts: dayStart(1) },
    { label: t('dateIn2'), ts: dayStart(2) },
    { label: t('dateIn7'), ts: dayStart(7) },
  ];
  const isPreset = (ts: number) => {
    const a = new Date(value);
    a.setHours(0, 0, 0, 0);
    const b = new Date(ts);
    b.setHours(0, 0, 0, 0);
    return a.getTime() === b.getTime();
  };
  const timeOptions: string[] = [];
  for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 15) timeOptions.push(`${pad(h)}:${pad(m)}`);
  if (!timeOptions.includes(timeStr)) timeOptions.push(timeStr);
  timeOptions.sort();

  return (
    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label={t('startDate')}>
        <input type="date" className="inp num" value={dateStr} disabled={disabled} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={disabled}
              onClick={() => {
                const nd = new Date(value);
                const pd = new Date(p.ts);
                nd.setFullYear(pd.getFullYear(), pd.getMonth(), pd.getDate());
                onChange(nd.getTime());
              }}
              className={`px-2 py-0.5 rounded-md border text-[11px] font-bold transition-colors disabled:opacity-40 ${isPreset(p.ts) ? 'bg-gold-400 text-felt-950 border-gold-400' : 'border-line-soft text-cream-500 hover:border-felt-600 hover:text-cream-300'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('startTime')}>
        <select className="inp num" value={timeStr} disabled={disabled} onChange={(e) => setTime(e.target.value)}>
          {timeOptions.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function ParamsSection({ tor, editable }: { tor: Tournament; editable: boolean }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const numIn = (v: string) => Math.max(0, Number(v) || 0);
  return (
    <div className="card p-5 max-w-3xl">
      <div className="grid md:grid-cols-2 gap-3">
        <Field label={t('tournamentName')} className="md:col-span-2">
          <input className="inp" value={tor.name} disabled={!editable} onChange={(e) => actions.updateTournament(tor.id, { name: e.target.value })} />
        </Field>
        <StartDateTimeField value={tor.date} disabled={!editable} onChange={(ts) => actions.updateTournament(tor.id, { date: ts })} />
        <Field label={t('description')} className="md:col-span-2">
          <input className="inp" value={tor.description} disabled={!editable} onChange={(e) => actions.updateTournament(tor.id, { description: e.target.value })} />
        </Field>
        <Field label={t('season')}>
          <select className="inp" value={tor.seasonId ?? ''} disabled={!editable} onChange={(e) => actions.updateTournament(tor.id, { seasonId: e.target.value || null })}>
            <option value="">{t('noSeason')}</option>
            {s.seasons.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label={t('startingStack')}>
          <input className="inp num" type="number" value={tor.startingStack} disabled={!editable} onChange={(e) => actions.updateTournament(tor.id, { startingStack: numIn(e.target.value) })} />
        </Field>
        <Field label={t('regCloses')}>
          <div className="flex gap-1.5 items-center">
            {tor.registrationClosesAt != null ? (
              <HMSInput seconds={Math.max(0, Math.round((tor.registrationClosesAt - tor.date) / 1000))} disabled={!editable} onChange={(sec) => actions.updateTournament(tor.id, { registrationClosesAt: tor.date + sec * 1000 })} />
            ) : (
              <span className="inp !w-28 !text-center num text-cream-500">∞</span>
            )}
            <button
              className={`px-2.5 py-2 rounded-lg border text-sm font-bold transition-colors disabled:opacity-35 ${tor.registrationClosesAt == null ? 'border-gold-400/50 text-gold-300 bg-gold-400/10' : 'border-line-soft text-cream-500 hover:border-felt-600'}`}
              disabled={!editable} title={t('unlimited')}
              onClick={() => actions.updateTournament(tor.id, { registrationClosesAt: tor.registrationClosesAt == null ? tor.date + 40 * 60_000 : null })}
            >
              ∞
            </button>
          </div>
        </Field>
        <Field label={t('rebuyCloses')}>
          <div className="flex gap-1.5 items-center">
            {tor.rebuyClosesAt != null ? (
              <HMSInput seconds={Math.max(0, Math.round((tor.rebuyClosesAt - tor.date) / 1000))} disabled={!editable} onChange={(sec) => actions.updateTournament(tor.id, { rebuyClosesAt: tor.date + sec * 1000 })} />
            ) : (
              <span className="inp !w-28 !text-center num text-cream-500">∞</span>
            )}
            <button
              className={`px-2.5 py-2 rounded-lg border text-sm font-bold transition-colors disabled:opacity-35 ${tor.rebuyClosesAt == null ? 'border-gold-400/50 text-gold-300 bg-gold-400/10' : 'border-line-soft text-cream-500 hover:border-felt-600'}`}
              disabled={!editable} title={t('unlimited')}
              onClick={() => actions.updateTournament(tor.id, { rebuyClosesAt: tor.rebuyClosesAt == null ? tor.date + 150 * 60_000 : null })}
            >
              ∞
            </button>
          </div>
        </Field>
      </div>
      <p className="mt-2 text-[11px] text-cream-700 flex items-center gap-1.5"><Icon name="timer" size={12} /> {t('windowFromStart')}</p>

      <div className="mt-4 pt-4 border-t border-line-soft">
        <div className="text-[10px] uppercase tracking-[0.18em] text-cream-500 font-bold mb-2.5 flex items-center gap-2">
          <Icon name="blinds" size={13} /> {t('costs')}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={`${t('rebuyCost')}`}>
            <input className="inp num" type="number" value={tor.rebuyChips} disabled={!editable} onChange={(e) => actions.updateTournament(tor.id, { rebuyChips: numIn(e.target.value) })} />
          </Field>
          <Field label={`${t('reentryCost')}`}>
            <input className="inp num" type="number" value={tor.reentryChips} disabled={!editable} onChange={(e) => actions.updateTournament(tor.id, { reentryChips: numIn(e.target.value) })} />
          </Field>
          <Field label={`${t('addonCost')}`}>
            <input className="inp num" type="number" value={tor.addonChips} disabled={!editable} onChange={(e) => actions.updateTournament(tor.id, { addonChips: numIn(e.target.value) })} />
          </Field>
        </div>
        <p className="mt-2 text-[11px] text-cream-700 flex items-center gap-1.5"><Icon name="info" size={12} /> {t('costsHint')}</p>
      </div>

      <div className="mt-4 pt-4 border-t border-line-soft">
        <div className="text-[10px] uppercase tracking-[0.18em] text-cream-500 font-bold mb-2.5 flex items-center gap-2">
          <Icon name="bolt" size={13} /> {t('knockoutPoints')}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Toggle
            checked={tor.knockoutPointsEnabled}
            disabled={!editable}
            onChange={(v) => actions.updateTournament(tor.id, { knockoutPointsEnabled: v })}
            label={t('knockoutPointsEnable')}
          />
          <Field label={t('koPoints')} className="!w-24">
            <input className="inp num" type="number" value={tor.knockoutPoints} disabled={!editable || !tor.knockoutPointsEnabled} onChange={(e) => actions.updateTournament(tor.id, { knockoutPoints: numIn(e.target.value) })} />
          </Field>
        </div>
        <p className="mt-2 text-[11px] text-cream-700 flex items-center gap-1.5"><Icon name="info" size={12} /> {t('knockoutPointsHint')}</p>
      </div>

      <p className="mt-3 text-[11px] text-cream-500 flex items-center gap-2"><Icon name="info" size={13} /> {t('rebuyWindowHint')}</p>
      {!editable && <p className="mt-2 text-xs text-cream-500 flex items-center gap-2"><Icon name="info" size={13} /> {t('readOnly')}</p>}
    </div>
  );
}

function BonusesSection({ tor, editable }: { tor: Tournament; editable: boolean }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const numIn = (v: string) => Math.max(0, Number(v) || 0);
  const setBonuses = (list: Tournament['bonuses']) => actions.updateTournament(tor.id, { bonuses: list });
  return (
    <div className="card p-4 max-w-2xl">
      <h3 className="font-display text-lg text-gold-300 mb-1 flex items-center gap-2"><Icon name="bell" size={16} /> {t('bonusesSection')}</h3>
      <p className="text-[11px] text-cream-500 mb-3 flex items-center gap-2"><Icon name="info" size={13} /> {t('bonusesHint')}</p>
      <div className="flex flex-col gap-2">
        {tor.bonuses.map((b) => (
          <div key={b.id} className="flex items-center gap-2 rounded-lg border border-line-soft bg-felt-900/60 px-3 py-2">
            <input
              className="inp flex-1" value={b.name} disabled={!editable} placeholder={t('bonusName')}
              onChange={(e) => setBonuses(tor.bonuses.map((x) => (x.id === b.id ? { ...x, name: e.target.value } : x)))}
            />
            <input
              className="inp !w-24 num" type="number" value={b.chips} disabled={!editable}
              onChange={(e) => setBonuses(tor.bonuses.map((x) => (x.id === b.id ? { ...x, chips: numIn(e.target.value) } : x)))}
            />
            <span className="text-[11px] text-cream-700 font-bold shrink-0">{t('bonusChipsLbl')}</span>
            <RowBtn icon="trash" red disabled={!editable} onClick={() => setBonuses(tor.bonuses.filter((x) => x.id !== b.id))} />
          </div>
        ))}
        {tor.bonuses.length === 0 && (
          <div className="rounded-lg border border-dashed border-line-soft px-3 py-4 text-center text-xs text-cream-500">{t('noBonuses')}</div>
        )}
      </div>
      <div className="mt-3">
        <Btn size="sm" icon="plus" disabled={!editable} onClick={() => setBonuses([...tor.bonuses, { id: uid(), name: '', chips: 1000 }])}>
          {t('addBonus')}
        </Btn>
      </div>
    </div>
  );
}

function RegistrationSection({ tor, editable }: { tor: Tournament; editable: boolean }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [q, setQ] = useState('');
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const closed = regClosed(tor);
  const isLive = tor.status === 'running' || tor.status === 'paused' || tor.status === 'break';
  const registered = useMemo(() => new Set(tor.entries.map((e) => e.playerId)), [tor.entries]);
  const list = s.players
    .filter((p) => p.status !== 'archived')
    .filter((p) => `${p.firstName} ${p.lastName} ${p.nickname}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'ru'));
  const nameOf = (pid: string) => {
    const p = s.players.find((x) => x.id === pid);
    return p ? fullName(p) : '—';
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-4">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h3 className="font-display text-lg text-gold-300">{isLive ? t('lateReg') : t('masterList')}</h3>
          <div className="flex gap-2">
            <div className="relative">
              <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cream-700" />
              <input className="inp !pl-8 !w-44" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Btn size="sm" variant="gold" icon="plus" disabled={!editable || isLive} onClick={() => { actions.registerAll(tor.id); toast(t('addAll')); }}>{t('addAll')}</Btn>
          </div>
        </div>
        {closed ? (
          <div className="mb-3 rounded-lg border border-loss/30 bg-loss/10 px-3 py-2.5 text-xs text-loss font-semibold flex items-center gap-2">
            <Icon name="info" size={14} /> {t('regClosedHint')}
          </div>
        ) : tor.registrationClosesAt ? (
          <div className="mb-3 rounded-lg border border-win/25 bg-win/8 px-3 py-2.5 text-xs text-win font-semibold flex items-center gap-2">
            <Icon name="timer" size={14} />
            {t('regWindow')}: {t('window.left')} {fmtClock(Math.max(0, Math.round((tor.registrationClosesAt - Date.now()) / 1000)))} · {t('regCloses').split(' ')[0]}. {fmtTimeOfDay(tor.registrationClosesAt)}
            {isLive && <Badge tone="green">{t('lateReg')}</Badge>}
          </div>
        ) : null}
        <div className="flex flex-col gap-1 max-h-[52vh] overflow-y-auto pr-1">
          {list.map((p) => {
            const inT = registered.has(p.id);
            return (
              <button
                key={p.id}
                disabled={!editable && !inT}
                onClick={() => { actions.toggleEntry(tor.id, p.id); }}
                className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors disabled:opacity-50 ${inT ? 'border-gold-400/40 bg-gold-400/8' : 'border-line-soft bg-felt-900/50 hover:border-felt-600'}`}
              >
                <span className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 transition-colors ${inT ? 'bg-gold-400 border-gold-400 text-felt-950' : 'border-felt-600'}`}>
                  {inT && <Icon name="check" size={12} />}
                </span>
                <Avatar name={fullName(p)} color={p.avatarColor} size={26} />
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-semibold truncate block">{fullName(p)} <span className="text-cream-700 text-xs">«{p.nickname}»</span></span>
                </span>
                {p.status === 'blocked' && <Badge tone="red">{t('status.blocked')}</Badge>}
              </button>
            );
          })}
          {list.length === 0 && <EmptyState icon="search" text={t('empty')} />}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg text-gold-300">{t('participants')} · {tor.entries.length}</h3>
          {tor.entries.length > 0 && <Btn size="sm" variant="ghost" icon="trash" disabled={!editable} onClick={() => actions.clearEntries(tor.id)}>{t('removeAll')}</Btn>}
        </div>
        <div className="flex flex-col gap-1 max-h-[52vh] overflow-y-auto pr-1">
          {tor.entries.map((e) => {
            const p = s.players.find((x) => x.id === e.playerId);
            return (
              <div key={e.playerId} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-felt-900/50 px-2.5 py-1.5">
                <Avatar name={p ? fullName(p) : '?'} color={p?.avatarColor ?? null} size={26} />
                <span className="flex-1 text-sm font-semibold truncate">{nameOf(e.playerId)}</span>
                <span className="text-[11px] num text-cream-500">{fmtChips(e.stack)}</span>
                {e.tableId && <Badge tone="neutral">{tor.tables.find((x) => x.id === e.tableId)?.name ?? ''}{e.seat ? ` · ${e.seat}` : ''}</Badge>}
                {editable && (
                  <button className="p-1 rounded text-cream-700 hover:text-loss hover:bg-loss/10" onClick={() => actions.toggleEntry(tor.id, e.playerId)} title={t('remove')}>
                    <Icon name="x" size={13} />
                  </button>
                )}
              </div>
            );
          })}
          {tor.entries.length === 0 && <EmptyState icon="users" text={t('empty')} />}
        </div>
      </div>
    </div>
  );
}

function StructureSection({ tor, editable }: { tor: Tournament; editable: boolean }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const totalMin = tor.levels.reduce((a, l) => a + l.duration, 0);
  const playCount = tor.levels.filter((l) => !l.isBreak).length;
  const numIn = (v: string) => Math.max(0, Number(v) || 0);
  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
        <Btn size="sm" icon="timer" disabled={!editable} onClick={() => { actions.loadStructure(tor.id, blindLevels('classic')); toast(t('preset.classic')); }}>{t('preset.classic')}</Btn>
        <Btn size="sm" icon="bolt" disabled={!editable} onClick={() => { actions.loadStructure(tor.id, blindLevels('turbo')); toast(t('preset.turbo')); }}>{t('preset.turbo')}</Btn>
        <div className="flex-1" />
        <span className="text-xs text-cream-500 num font-semibold">{playCount} {t('level').toLowerCase()} · {Math.floor(totalMin / 60)} ч {totalMin % 60} {t('min')}</span>
        <Btn size="sm" icon="plus" disabled={!editable} onClick={() => actions.addLevel(tor.id, false)}>{t('addLevel')}</Btn>
        <Btn size="sm" icon="coffee" disabled={!editable} onClick={() => actions.addLevel(tor.id, true)}>{t('addBreak')}</Btn>
      </div>
      <div className="text-[11px] text-cream-500 mb-3 flex items-center gap-2"><Icon name="info" size={13} /> {t('structureHint')}</div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-cream-500 border-b border-line-soft">
              <th className="px-3 py-2.5 font-bold w-14">#</th>
              <th className="px-3 py-2.5 font-bold">SB</th>
              <th className="px-3 py-2.5 font-bold">BB</th>
              <th className="px-3 py-2.5 font-bold">{t('ante')}</th>
              <th className="px-3 py-2.5 font-bold">{t('durationMin')}</th>
              <th className="px-3 py-2.5 font-bold w-24"></th>
            </tr>
          </thead>
          <tbody>
            {tor.levels.map((l, i) => {
              const num = tor.levels.slice(0, i + 1).filter((x) => !x.isBreak).length;
              return (
                <tr key={l.id} className="border-b border-line-soft/60 last:border-0 hover:bg-felt-800/40">
                  <td className="px-3 py-1.5">
                    {l.isBreak ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gold-300 bg-gold-400/10 border border-gold-400/25 rounded px-1.5 py-0.5"><Icon name="coffee" size={11} /> {t('break')}</span>
                    ) : (
                      <span className="font-display text-lg num text-cream-500">{num}</span>
                    )}
                  </td>
                  {l.isBreak ? (
                    <td colSpan={3} className="px-3 py-1.5 text-cream-700 italic text-xs">—</td>
                  ) : (
                    <>
                      <td className="px-3 py-1.5"><input className="inp !w-24 !py-1 num" type="number" value={l.sb} disabled={!editable} onChange={(e) => actions.updateLevel(tor.id, l.id, { sb: numIn(e.target.value) })} /></td>
                      <td className="px-3 py-1.5"><input className="inp !w-24 !py-1 num" type="number" value={l.bb} disabled={!editable} onChange={(e) => actions.updateLevel(tor.id, l.id, { bb: numIn(e.target.value) })} /></td>
                      <td className="px-3 py-1.5"><input className="inp !w-24 !py-1 num" type="number" value={l.ante} disabled={!editable} onChange={(e) => actions.updateLevel(tor.id, l.id, { ante: numIn(e.target.value) })} /></td>
                    </>
                  )}
                  <td className="px-3 py-1.5"><input className="inp !w-20 !py-1 num" type="number" value={l.duration} disabled={!editable} onChange={(e) => actions.updateLevel(tor.id, l.id, { duration: Math.max(1, numIn(e.target.value)) })} /></td>
                  <td className="px-3 py-1.5">
                    <div className="flex justify-end gap-0.5">
                      <RowBtn icon="up" disabled={!editable || i === 0} onClick={() => actions.moveLevel(tor.id, l.id, -1)} />
                      <RowBtn icon="down" disabled={!editable || i === tor.levels.length - 1} onClick={() => actions.moveLevel(tor.id, l.id, 1)} />
                      <RowBtn icon="trash" red disabled={!editable} onClick={() => actions.removeLevel(tor.id, l.id)} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {tor.levels.length === 0 && <EmptyState icon="blinds" text={t('empty')} />}
      </div>
    </div>
  );
}

function RowBtn({ icon, onClick, disabled, red }: { icon: string; onClick: () => void; disabled?: boolean; red?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`p-1.5 rounded-md transition-colors disabled:opacity-20 disabled:pointer-events-none ${red ? 'text-cream-500 hover:text-loss hover:bg-loss/10' : 'text-cream-500 hover:text-gold-300 hover:bg-felt-750'}`}>
      <Icon name={icon} size={14} />
    </button>
  );
}

function PointsSection({ tor, editable }: { tor: Tournament; editable: boolean }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const numIn = (v: string) => Math.max(0, Number(v) || 0);
  const previewN = Math.max(tor.entries.length, tor.pointsGrid.length + 2, 12);
  return (
    <div className="grid lg:grid-cols-2 gap-4 max-w-4xl">
      <div className="card p-4">
        <h3 className="font-display text-lg text-gold-300 mb-1">{t('pointsGrid')}</h3>
        <p className="text-[11px] text-cream-500 mb-3">{t('gridHint')}</p>
        <div className="flex flex-col gap-1.5 max-h-[42vh] overflow-y-auto pr-1">
          {tor.pointsGrid.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="font-display text-lg num text-cream-500 w-8">{r.place}.</span>
              <input className="inp !w-24 !py-1 num" type="number" value={r.points} disabled={!editable} onChange={(e) => {
                const rows = tor.pointsGrid.map((x, j) => (j === i ? { ...x, points: numIn(e.target.value) } : x));
                actions.setPointsGrid(tor.id, rows);
              }} />
              <span className="text-xs text-cream-500">{t('pts')}</span>
              <div className="flex-1" />
              <RowBtn icon="trash" red disabled={!editable} onClick={() => actions.setPointsGrid(tor.id, tor.pointsGrid.filter((_, j) => j !== i).map((x, j) => ({ ...x, place: j + 1 })))} />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <Btn size="sm" icon="plus" disabled={!editable} onClick={() => {
            const last = tor.pointsGrid[tor.pointsGrid.length - 1];
            actions.setPointsGrid(tor.id, [...tor.pointsGrid, { place: tor.pointsGrid.length + 1, points: Math.max(1, Math.round((last?.points ?? 10) * 0.8)) }]);
          }}>{t('add')}</Btn>
        </div>
        <div className="grid grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-line-soft">
          <Field label={t('participationPoints')}>
            <input className="inp num" type="number" value={tor.participationPoints} disabled={!editable} onChange={(e) => actions.setParticipation(tor.id, numIn(e.target.value))} />
          </Field>
          <Field label={t('rebuyPenalty')}>
            <input className="inp num" type="number" value={tor.rebuyPenalty} disabled={!editable} onChange={(e) => actions.setPenalties(tor.id, { rebuy: numIn(e.target.value) })} />
          </Field>
          <Field label={t('addonPenalty')}>
            <input className="inp num" type="number" value={tor.addonPenalty} disabled={!editable} onChange={(e) => actions.setPenalties(tor.id, { addon: numIn(e.target.value) })} />
          </Field>
        </div>
        <p className="text-[10px] text-cream-700 mt-2">{t('participationHint')} · {t('penaltyHint')}</p>
      </div>

      <div className="card p-4">
        <h3 className="font-display text-lg text-gold-300 mb-3">{t('sec.results')} · {t('points')}</h3>
        <div className="flex flex-col gap-1 max-h-[52vh] overflow-y-auto pr-1">
          {Array.from({ length: previewN }).map((_, i) => {
            const place = i + 1;
            const inGrid = place <= tor.pointsGrid.length;
            return (
              <div key={i} className={`flex items-center gap-2.5 rounded-lg border px-3 py-1.5 ${inGrid ? 'border-line-soft bg-felt-900/50' : 'border-dashed border-line-soft/70'}`}>
                <span className={`font-display text-lg num w-8 ${place === 1 ? 'text-gold-300' : place === 2 ? 'text-[#dbe2e8]' : place === 3 ? 'text-[#e0a86b]' : 'text-cream-500'}`}>{place}.</span>
                <span className="flex-1 text-xs text-cream-500">{inGrid ? '' : t('participation')}</span>
                <span className="font-display text-xl num text-gold-300">+{entryPoints(tor, place)}</span>
                <span className="text-[11px] text-cream-500">{t('pts')}</span>
              </div>
            );
          })}
        </div>
      </div>
      <span className="hidden">{s.players.length}</span>
    </div>
  );
}

/* ================= SEATING ================= */

function SeatingSection({ tor, editable }: { tor: Tournament; editable: boolean }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const activeEntries = tor.entries.filter((e) => !e.eliminated);
  const isLive = tor.status === 'running' || tor.status === 'paused' || tor.status === 'break';
  const waiting = activeEntries.filter((e) => !e.tableId).sort((a, b) => a.registeredAt - b.registeredAt);
  const sugs = useMemo(() => balanceSuggestions(tor.entries, tor.tables), [tor.entries, tor.tables]);
  const nameOf = (pid: string) => {
    const p = s.players.find((x) => x.id === pid);
    return p ? fullName(p) : '—';
  };
  const pointsMap = useMemo(() => new Map(leaderboardRows(s.players, s.tournaments, null).map((r) => [r.playerId, r.points])), [s.players, s.tournaments]);

  const dropTo = (tableId: string, seat: number, e: DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const pid = e.dataTransfer.getData('text/plain');
    if (pid) actions.assignSeat(tor.id, pid, tableId, seat);
  };
  const clickSeat = (tableId: string, seat: number) => {
    if (selected) {
      actions.assignSeat(tor.id, selected, tableId, seat);
      setSelected(null);
    }
  };

  const chip = (pid: string, extra?: React.ReactNode) => {
    const p = s.players.find((x) => x.id === pid);
    const entry = tor.entries.find((x) => x.playerId === pid);
    return (
      <div
        key={pid}
        draggable={editable}
        onDragStart={(e) => e.dataTransfer.setData('text/plain', pid)}
        onClick={() => editable && setSelected(selected === pid ? null : pid)}
        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 bg-felt-800 ${editable ? 'cursor-grab active:cursor-grabbing' : ''} ${selected === pid ? 'border-gold-400 ring-2 ring-gold-400/30' : 'border-line-soft'} ${selected === pid ? '' : 'hover:border-felt-600'} transition-all`}
        title={`${t('stack')}: ${fmtChips(entry?.stack ?? 0)}`}
      >
        <Icon name="drag" size={13} className="text-cream-700 shrink-0" />
        <Avatar name={p?.nickname ?? '?'} color={p?.avatarColor ?? null} avatarData={p?.avatarData ?? null} size={24} />
        <div className="min-w-0 flex-1 leading-tight">
          <span className="block text-xs font-extrabold truncate">{p?.nickname ?? nameOf(pid)}</span>
          <span className="block text-[9px] text-cream-500 truncate">{nameOf(pid)}</span>
        </div>
        <span className="text-[10px] num text-gold-300 shrink-0">{fmtChips(entry?.stack ?? 0)}</span>
        {entry && entry.rebuys > 0 && <span className="text-[10px] font-bold text-info shrink-0">R{entry.rebuys}</span>}
        {extra}
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Btn size="sm" variant="gold" icon="bolt" title={isLive ? t('seatDisabledLive') : undefined} disabled={!editable || isLive || activeEntries.length === 0 || tor.tables.length === 0} onClick={() => { actions.autoSeat(tor.id, 'random'); toast(t('autoSeat')); }}>{t('random')}</Btn>
        <Btn size="sm" icon="trophy" title={isLive ? t('seatDisabledLive') : undefined} disabled={!editable || isLive || activeEntries.length === 0 || tor.tables.length === 0} onClick={() => { actions.autoSeat(tor.id, 'rating'); toast(t('byRating')); }}>{t('byRating')}</Btn>
        <Btn size="sm" icon="dice" disabled={!editable || waiting.length === 0 || tor.tables.length === 0} onClick={() => { actions.seatRandom(tor.id, null); toast(t('seatAllRandom')); }}>{t('seatAllRandom')}</Btn>
        <Btn size="sm" icon="plus" disabled={!editable} onClick={() => actions.addTable(tor.id, 9)}>{t('addTable')}</Btn>
      </div>
      <div className="text-[11px] text-cream-500 flex items-center gap-1.5 mb-3 flex-wrap">
        <span className="flex items-center gap-1.5"><Icon name="info" size={12} /> {t('dragHint')}</span>
        <span className="flex items-center gap-1.5 text-gold-500/90"><Icon name="dice" size={12} /> {isLive ? t('seatDisabledLive') : t('seatRandomHint')}</span>
      </div>

      {sugs.length > 0 && (
        <div className="card p-3.5 mb-4 border-gold-400/30">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-sm font-bold text-gold-300 flex items-center gap-2"><Icon name="swap" size={15} /> {t('suggestions')} · {sugs.length}</span>
            <Btn size="sm" variant="gold" disabled={!editable} onClick={() => { sugs.forEach((sg) => actions.applySuggestion(tor.id, sg)); toast(t('applyAll')); }}>{t('applyAll')}</Btn>
          </div>
          <div className="flex flex-wrap gap-2">
            {sugs.map((sg, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-line-soft bg-felt-900/60 px-2.5 py-1.5 text-xs">
                <b>{nameOf(sg.playerId)}</b>
                <span className="text-cream-500">{sg.fromName} → {sg.toName}</span>
                <button className="p-0.5 rounded text-gold-300 hover:bg-gold-400/10" disabled={!editable} onClick={() => actions.applySuggestion(tor.id, sg)} title={t('apply')}>
                  <Icon name="check" size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3 grid sm:grid-cols-2 gap-4 content-start">
          {tor.tables.map((tb) => {
            const seated = tor.entries.filter((e) => e.tableId === tb.id && !e.eliminated);
            return (
              <div key={tb.id} className="card p-3.5">
                <div className="flex items-center gap-2 mb-2.5">
                  <input className="inp !w-32 !py-1 font-bold" value={tb.name} disabled={!editable} onChange={(e) => actions.updateTable(tor.id, tb.id, { name: e.target.value })} />
                  <input className="inp !w-14 !py-1 num" type="number" value={tb.seats} disabled={!editable} onChange={(e) => actions.updateTable(tor.id, tb.id, { seats: Number(e.target.value) || 2 })} />
                  <span className="text-[10px] text-cream-700 uppercase font-bold">{t('seats')}</span>
                  <div className="flex-1" />
                  <span className="text-xs num text-cream-500">{seated.length}/{tb.seats}</span>
                  <RowBtn icon="trash" red disabled={!editable} onClick={() => actions.removeTable(tor.id, tb.id)} />
                </div>
                <div className="relative w-full aspect-[1.6] select-none">
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[54%] h-[60%] rounded-[50%] border border-gold-600/50 shadow-[0_0_0_5px_rgba(242,193,78,0.06),0_10px_30px_rgba(0,0,0,0.5)]" style={{ background: 'radial-gradient(ellipse at center, #20463080 0%, #14291c 70%, #0e1f15 100%)' }}>
                    <div className="absolute inset-[7%] rounded-[50%] border border-gold-500/25" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
                      <Icon name="spade" size={15} className="text-gold-500/70" filled />
                      <span className="font-display text-gold-200/90 text-sm leading-tight truncate max-w-full">{tb.name}</span>
                    </div>
                  </div>
                  <div className="absolute inset-[2%]">
                    {seatPositions(tb.seats).map((pos, i) => {
                      const seat = i + 1;
                      const occupant = tor.entries.find((e) => e.tableId === tb.id && e.seat === seat && !e.eliminated);
                      const key = `${tb.id}:${seat}`;
                      const occ = occupant ? s.players.find((x) => x.id === occupant.playerId) : null;
                      const isSelTarget = selected && (!occupant || occupant.playerId !== selected);
                      return (
                        <div
                          key={seat}
                          onDragOver={(e) => { e.preventDefault(); setDragOver(key); }}
                          onDragLeave={() => setDragOver((k) => (k === key ? null : k))}
                          onDrop={(e) => dropTo(tb.id, seat, e)}
                          onClick={() => clickSeat(tb.id, seat)}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform ${dragOver === key ? 'drag-over scale-105' : ''} ${isSelTarget ? 'cursor-pointer' : ''}`}
                          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                          title={occupant ? (selected && selected !== occupant.playerId ? t('occupied') : nameOf(occupant.playerId)) : t('moveHere')}
                        >
                          {occupant ? (
                            <div className={`flex items-center gap-1.5 rounded-full border pl-0.5 pr-1 py-0.5 bg-felt-800/95 shadow-lg min-w-[84px] max-w-[118px] ${selected === occupant.playerId ? 'border-gold-400 ring-2 ring-gold-400/40' : 'border-line'}`}>
                              <Avatar name={occ ? occ.nickname : '?'} color={occ?.avatarColor ?? null} avatarData={occ?.avatarData ?? null} size={22} />
                              <div className="min-w-0 flex-1 leading-none">
                                <div className="text-[11px] font-extrabold text-cream-100 truncate">{occ?.nickname ?? nameOf(occupant.playerId)}</div>
                                <div className="text-[8px] text-cream-500 truncate mt-0.5">{nameOf(occupant.playerId)}</div>
                              </div>
                              {editable && (
                                <button className="p-0.5 rounded-full text-cream-700 hover:text-loss shrink-0" onClick={(e) => { e.stopPropagation(); actions.unseat(tor.id, occupant.playerId); }}>
                                  <Icon name="x" size={11} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-[10px] num font-bold transition-colors ${dragOver === key ? 'border-gold-400 bg-gold-400/15 text-gold-300' : selected ? 'border-gold-400/60 border-dashed bg-gold-400/10 text-gold-300' : 'border-line-soft/80 border-dashed text-cream-700 bg-felt-900/60'}`}>
                              {seat}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          {tor.tables.length === 0 && <div className="sm:col-span-2"><EmptyState icon="table" text={t('empty')} /></div>}
        </div>

        <div className="card p-3.5 h-fit">
          <h4 className="font-display text-lg text-gold-300 mb-2">{t('waitingList')} · {waiting.length}</h4>
          <div className="flex flex-col gap-1.5 max-h-[52vh] overflow-y-auto pr-1">
            {waiting.map((e) =>
              chip(
                e.playerId,
                editable ? (
                  <button
                    className="p-1 rounded-md text-cream-500 hover:text-gold-300 hover:bg-gold-400/10 transition-colors shrink-0"
                    title={t('seatRandomOne')}
                    onClick={(ev) => { ev.stopPropagation(); actions.seatRandom(tor.id, e.playerId); toast(t('seatRandomOne')); }}
                  >
                    <Icon name="dice" size={15} />
                  </button>
                ) : undefined,
              ),
            )}
            {waiting.length === 0 && <div className="text-xs text-cream-700 italic py-2">{t('empty')}</div>}
          </div>
        </div>
      </div>
      <span className="hidden">{pointsMap.size}</span>
    </div>
  );
}

function ResultsSection({ tor }: { tor: Tournament }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const rows = tor.results ?? [];
  const nameOf = (pid: string) => {
    const p = s.players.find((x) => x.id === pid);
    return p ? fullName(p) : '—';
  };
  return (
    <div className="card p-5 max-w-3xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-display text-xl text-gold-300">{t('resultsTitle')} · {tor.name}</h3>
        <button className="text-xs font-bold text-cream-500 hover:text-gold-300 flex items-center gap-1.5 transition-colors" onClick={() => window.print()}>
          <Icon name="print" size={14} /> {t('print')}
        </button>
      </div>
      
      <TournamentPointsChart tournament={tor} height={200} />

      <div className="flex flex-col gap-1.5 print-area mt-4">
        {rows.map((r) => {
          const e = tor.entries.find((x) => x.playerId === r.playerId);
          return (
            <div key={r.playerId} className="flex items-center gap-3 rounded-lg border border-line-soft bg-felt-900/50 px-3.5 py-2">
              <span className={`font-display text-2xl num w-10 ${r.place === 1 ? 'text-gold-300' : r.place === 2 ? 'text-[#dbe2e8]' : r.place === 3 ? 'text-[#e0a86b]' : 'text-cream-500'}`}>{r.place}.</span>
              <span className="flex-1 font-semibold truncate">{nameOf(r.playerId)}</span>
              {e && (e.rebuys > 0 || e.addons > 0) && <span className="text-[11px] num text-cream-500">R{e.rebuys} · A{e.addons}</span>}
              <span className="font-display text-xl num text-gold-300">+{r.points} {t('pts')}</span>
            </div>
          );
        })}
        {rows.length === 0 && <EmptyState icon="trophy" text={t('empty')} />}
      </div>
      <p className="text-[11px] text-cream-500 mt-3 flex items-center gap-2"><Icon name="info" size={13} /> {t('autoFinishNote')}</p>
    </div>
  );
}