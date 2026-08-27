import { useRef, useState } from 'react';
import type { ScreenMode } from '../lib/types';
import { actions, can, getState, useApp } from '../lib/store';
import { makeT } from '../lib/i18n';
import { seedState } from '../lib/data';
import { downloadFile, fmtTimeOfDay, readImageFile } from '../lib/utils';
import { Badge, Btn, Field, Icon, Modal, Toggle, toast } from '../components/ui';
import { ScreenView } from '../screen/ScreenView';

export function openScreen(mode: ScreenMode) {
  const base = window.location.href.split('#')[0];
  window.open(`${base}#/screen/${mode}`, '_blank', 'noopener');
}

function SeasonModal({ title, initial, onClose, onSave }: { title: string; initial: string; onClose: () => void; onSave: (name: string) => void }) {
  const t = makeT(useApp().settings.language);
  const [val, setVal] = useState(initial);
  return (
    <Modal title={title} onClose={onClose} footer={
      <>
        <Btn variant="ghost" onClick={onClose}>{t('cancel')}</Btn>
        <Btn variant="gold" icon="check" disabled={!val.trim()} onClick={() => { onSave(val.trim()); onClose(); }}>{t('save')}</Btn>
      </>
    }>
      <Field label={t('seasonName')}>
        <input className="inp" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && val.trim()) { onSave(val.trim()); onClose(); } }} autoFocus />
      </Field>
    </Modal>
  );
}

/* ================= SCREENS ================= */

export function ScreensTab() {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [mode, setMode] = useState<ScreenMode>('live');
  const [msg, setMsg] = useState('');
  const club = can('club');
  const cfg = s.settings.screens;

  const modes: { id: ScreenMode; icon: string; title: string; desc: string }[] = [
    { id: 'live', icon: 'timer', title: t('liveScreen'), desc: t('liveScreenDesc') },
    { id: 'tables', icon: 'table', title: t('tablesScreen'), desc: t('tablesScreenDesc') },
    { id: 'board', icon: 'trophy', title: t('boardScreen'), desc: t('boardScreenDesc') },
    { id: 'results', icon: 'crown', title: t('resultsScreen'), desc: t('resultsScreenDesc') },
  ];

  const toggles: { key: 'showTimer' | 'showBlinds' | 'showStats' | 'showTicker'; label: string }[] = [
    { key: 'showTimer', label: t('el.timer') },
    { key: 'showBlinds', label: t('el.blinds') },
    { key: 'showStats', label: t('el.stats') },
    { key: 'showTicker', label: t('el.ticker') },
  ];

  return (
    <div className="anim-rise grid grid-cols-12 gap-4">
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">
        {modes.map((m) => (
          <div key={m.id} className="card p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold-400/12 text-gold-300 flex items-center justify-center shrink-0"><Icon name={m.icon} size={19} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">{m.title}</div>
              <div className="text-[11px] text-cream-500 truncate">{m.desc}</div>
            </div>
            <Btn size="sm" icon="expand" onClick={() => openScreen(m.id)}>{t('openScreen')}</Btn>
          </div>
        ))}
        <div className="text-[11px] text-cream-500 leading-relaxed px-1 flex gap-2"><Icon name="info" size={13} className="shrink-0 mt-0.5" /> {t('screenHint')}</div>
      </div>

      <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-display text-xl text-gold-300 flex items-center gap-2"><Icon name="eye" size={17} /> {t('preview')}</h3>
            <div className="flex gap-1 bg-felt-900 border border-line rounded-lg p-1">
              {modes.map((m) => (
                <button key={m.id} onClick={() => setMode(m.id)} className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${mode === m.id ? 'bg-gold-400 text-felt-950' : 'text-cream-500 hover:text-cream-100'}`}>
                  {m.title}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl overflow-hidden border border-line bg-black/60 aspect-video pointer-events-none">
            <ScreenView mode={mode} preview />
          </div>
        </div>

        <div className="card p-4">
          <h3 className="font-display text-xl text-gold-300 mb-3">{t('screenElements')}</h3>
          {!club && <div className="mb-3 text-xs text-loss font-semibold flex items-center gap-2"><Icon name="info" size={13} /> {t('noAccess')}</div>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {toggles.map((tg) => (
              <Toggle key={tg.key} checked={cfg[tg.key]} disabled={!club} onChange={(v) => actions.setScreenConfig({ [tg.key]: v })} label={tg.label} />
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-line-soft">
            <Field label={t('boardSeason')}>
              <select className="inp max-w-xs" value={cfg.boardSeasonId ?? ''} disabled={!club} onChange={(e) => actions.setScreenConfig({ boardSeasonId: e.target.value || null })}>
                <option value="">{t('allTime')}</option>
                {s.seasons.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="font-display text-xl text-gold-300 mb-3 flex items-center gap-2"><Icon name="bell" size={17} /> {t('sendTicker')}</h3>
          <div className="flex gap-2">
            <input className="inp flex-1" placeholder={t('tickerPlaceholder')} value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && msg.trim()) { actions.sendTicker(msg.trim()); setMsg(''); toast(t('sendTicker')); } }} />
            <Btn variant="gold" icon="next" disabled={!msg.trim() || !can('live')} onClick={() => { actions.sendTicker(msg.trim()); setMsg(''); toast(t('sendTicker')); }}>{t('sendTicker').split(' ')[0]}</Btn>
          </div>
          <div className="mt-3 flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
            {s.ticker.map((i) => (
              <div key={i.id} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-felt-900/50 px-3 py-1.5 text-xs">
                <Badge tone={i.kind === 'alert' ? 'red' : i.kind === 'break' ? 'gold' : i.kind === 'level' ? 'green' : 'neutral'}>{i.kind}</Badge>
                <span className="flex-1 truncate font-semibold">{i.text}</span>
                <span className="text-cream-700 num shrink-0">{fmtTimeOfDay(i.time)}</span>
              </div>
            ))}
            {s.ticker.length === 0 && <div className="text-xs text-cream-700 italic py-1">{t('empty')}</div>}
          </div>
          {s.ticker.length > 0 && <Btn size="sm" variant="ghost" icon="trash" className="mt-2" disabled={!can('live')} onClick={() => actions.clearTicker()}>{t('delete')}</Btn>}
        </div>
      </div>
    </div>
  );
}

/* ================= SETTINGS ================= */

const ACCENTS = ['#f2c14e', '#e8833a', '#e0564f', '#5fb0d4', '#4cc38a'];

export function SettingsTab() {
  const s = useApp();
  const t = makeT(s.settings.language);
  const club = can('club');
  const structure = can('structure');
  const fileRef = useRef<HTMLInputElement>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [seasonName, setSeasonName] = useState('');
  const [seasonModal, setSeasonModal] = useState<{ id: string; name: string } | null>(null);
  const numIn = (v: string) => Math.max(0, Number(v) || 0);

  return (
    <div className="anim-rise grid grid-cols-12 gap-4 max-w-5xl">
      <div className="col-span-12 md:col-span-6 card p-5">
        <h3 className="font-display text-xl text-gold-300 mb-3 flex items-center gap-2"><Icon name="spade" size={18} filled /> {t('settingsClub')}</h3>
        {!club && <div className="mb-3 text-xs text-loss font-semibold flex items-center gap-2"><Icon name="info" size={13} /> {t('noAccess')} — {t('role.operator.desc')}</div>}
        <div className="grid gap-3">
          <Field label={t('clubName')}><input className="inp" value={s.settings.clubName} disabled={!club} onChange={(e) => actions.setSettings({ clubName: e.target.value })} /></Field>
          <Field label={t('logoUpload')}>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl border border-line-soft bg-felt-900/60 flex items-center justify-center overflow-hidden shrink-0">
                {s.settings.logo ? (
                  <img src={s.settings.logo} alt={s.settings.clubName} className="w-full h-full object-contain" />
                ) : (
                  <Icon name="spade" size={22} filled className="text-gold-500/50" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={`cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold w-fit rounded-lg px-3 py-1.5 transition-colors ${club ? 'text-felt-950 bg-gold-400 hover:bg-gold-300' : 'opacity-40 bg-felt-750 text-cream-500 pointer-events-none'}`}>
                  <Icon name="upload" size={13} /> {t('logoUpload')}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readImageFile(f, 240, (data, err) => { if (data) { actions.setSettings({ logo: data }); toast(t('logoUpload')); } if (err) toast(t(err), 'err'); });
                    e.target.value = '';
                  }} />
                </label>
                {s.settings.logo && club && (
                  <button className="text-[11px] text-cream-500 hover:text-loss font-semibold w-fit" onClick={() => actions.setSettings({ logo: null })}>{t('logoRemove')}</button>
                )}
              </div>
            </div>
          </Field>
          <p className="text-[11px] text-cream-700 -mt-1">{t('logoHint')}</p>
          <Field label={t('accentColor')}>
            <div className="flex gap-2 pt-1">
              {ACCENTS.map((c) => (
                <button key={c} disabled={!club} onClick={() => actions.setSettings({ accent: c })} className={`w-9 h-9 rounded-lg border-2 transition-transform hover:scale-110 disabled:opacity-40 ${s.settings.accent === c ? 'border-cream-100 scale-110' : 'border-transparent'}`} style={{ background: c }} />
              ))}
            </div>
          </Field>
          <Field label={t('language')}>
            <select className="inp" value={s.settings.language} disabled={!club} onChange={(e) => actions.setSettings({ language: e.target.value as 'ru' | 'en' })}>
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label={t('sound')}>
            <select className="inp" value={s.settings.sound} disabled={!club} onChange={(e) => actions.setSettings({ sound: e.target.value as 'off' | 'bell' | 'voice' })}>
              <option value="off">{t('sound.off')}</option>
              <option value="bell">{t('sound.bell')}</option>
              <option value="voice">{t('sound.voice')}</option>
            </select>
          </Field>
          <p className="text-[11px] text-cream-500">{t('clubBranding')}</p>
        </div>
      </div>

      <div className="col-span-12 md:col-span-6 flex flex-col gap-4">
        <div className="card p-5">
          <h3 className="font-display text-xl text-gold-300 mb-2 flex items-center gap-2"><Icon name="users" size={18} /> {t('roles')}</h3>
          <p className="text-[11px] text-cream-500 leading-relaxed flex items-start gap-2">
            <Icon name="info" size={13} className="shrink-0 mt-0.5" />
            <span>{t('roleFromLogin')}</span>
          </p>
        </div>

        <div className="card p-5">
          <h3 className="font-display text-xl text-gold-300 mb-3 flex items-center gap-2"><Icon name="trophy" size={18} /> {t('seasons')}</h3>
          <div className="flex flex-col gap-1.5 mb-3">
            {s.seasons.map((x) => {
              const count = s.tournaments.filter((tor) => tor.seasonId === x.id).length;
              return (
                <div key={x.id} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-felt-900/50 px-3 py-2 text-sm">
                  <Icon name="trophy" size={14} className="text-gold-300" />
                  <span className="flex-1 font-semibold">{x.name}</span>
                  <span className="text-[11px] num text-cream-500">{count} {t('tournamentsIn')}</span>
                  {structure && (
                    <>
                      <button className="p-1 rounded text-cream-700 hover:text-gold-300 hover:bg-gold-400/10" title={t('seasonEdit')} onClick={() => setSeasonModal({ id: x.id, name: x.name })}>
                        <Icon name="edit" size={13} />
                      </button>
                      <button className="p-1 rounded text-cream-700 hover:text-loss hover:bg-loss/10 disabled:opacity-25" disabled={count > 0} title={count > 0 ? t('seasonInUse') : t('delete')} onClick={() => { actions.deleteSeason(x.id); toast(t('delete'), 'warn'); }}>
                        <Icon name="trash" size={13} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            {s.seasons.length === 0 && <div className="text-xs text-cream-700 italic py-1">{t('empty')}</div>}
          </div>
          {structure && (
            <div className="flex gap-2">
              <input className="inp flex-1" placeholder={t('seasonName')} value={seasonName} onChange={(e) => setSeasonName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && seasonName.trim()) { actions.addSeason(seasonName.trim()); setSeasonName(''); toast(t('seasonCreate')); } }} />
              <Btn icon="plus" disabled={!seasonName.trim()} onClick={() => { actions.addSeason(seasonName.trim()); setSeasonName(''); toast(t('seasonCreate')); }}>{t('seasonCreate')}</Btn>
            </div>
          )}
        </div>
        {seasonModal && (
          <SeasonModal
            title={t('seasonEdit')}
            initial={seasonModal.name}
            onClose={() => setSeasonModal(null)}
            onSave={(name) => { actions.updateSeason(seasonModal.id, { name }); toast(t('seasonUpdated')); }}
          />
        )}
      </div>

      <div className="col-span-12 card p-5">
        <h3 className="font-display text-xl text-gold-300 mb-1 flex items-center gap-2"><Icon name="blinds" size={18} /> {t('templateTitle')}</h3>
        <p className="text-[11px] text-cream-500 mb-3">{t('templateHint')}</p>
        <div className="flex flex-wrap gap-2 items-center">
          {s.settings.pointsTemplate.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-lg border border-line-soft bg-felt-900/50 px-2.5 py-1.5">
              <span className="font-display num text-cream-500">{r.place}.</span>
              <input className="inp !w-16 !py-0.5 num !text-sm" type="number" value={r.points} disabled={!structure} onChange={(e) => {
                const rows = s.settings.pointsTemplate.map((x, j) => (j === i ? { ...x, points: numIn(e.target.value) } : x));
                actions.setTemplate({ pointsTemplate: rows });
              }} />
            </div>
          ))}
          {structure && (
            <Btn size="sm" icon="plus" onClick={() => {
              const last = s.settings.pointsTemplate[s.settings.pointsTemplate.length - 1];
              actions.setTemplate({ pointsTemplate: [...s.settings.pointsTemplate, { place: s.settings.pointsTemplate.length + 1, points: Math.max(1, Math.round((last?.points ?? 10) * 0.8)) }] });
            }}>{t('add')}</Btn>
          )}
          <div className="flex gap-4 ml-auto flex-wrap">
            <Field label={t('participationPoints')}>
              <input className="inp !w-20 num" type="number" value={s.settings.participationTemplate} disabled={!structure} onChange={(e) => actions.setTemplate({ participationTemplate: numIn(e.target.value) })} />
            </Field>
            <Field label={t('rebuyPenalty')}>
              <input className="inp !w-20 num" type="number" value={s.settings.rebuyPenaltyTemplate} disabled={!structure} onChange={(e) => actions.setTemplate({ rebuyPenaltyTemplate: numIn(e.target.value) })} />
            </Field>
            <Field label={t('addonPenalty')}>
              <input className="inp !w-20 num" type="number" value={s.settings.addonPenaltyTemplate} disabled={!structure} onChange={(e) => actions.setTemplate({ addonPenaltyTemplate: numIn(e.target.value) })} />
            </Field>
          </div>
        </div>
      </div>

      <div className="col-span-12 card p-5">
        <h3 className="font-display text-xl text-gold-300 mb-3 flex items-center gap-2"><Icon name="download" size={18} /> {t('backup')}</h3>
        <div className="flex flex-wrap gap-2">
          <Btn icon="download" disabled={!club} onClick={() => { downloadFile(`goldspade-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(getState(), null, 2)); toast(t('export')); }}>{t('export')}</Btn>
          <Btn icon="upload" disabled={!club} onClick={() => fileRef.current?.click()}>{t('import')}</Btn>
          <Btn variant="danger" icon="trash" disabled={!club} onClick={() => setResetOpen(true)}>{t('wipeData')}</Btn>
          <input
            ref={fileRef} type="file" accept="application/json" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const parsed = JSON.parse(String(reader.result));
                  if (!parsed?.settings || !parsed?.players || !parsed?.tournaments) throw new Error('bad');
                  actions.replaceAll(parsed);
                  toast(t('import'));
                } catch {
                  toast('JSON error', 'err');
                }
              };
              reader.readAsText(f);
              e.target.value = '';
            }}
          />
        </div>
        <div className="mt-3 text-[11px] text-cream-500 num flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-win anim-pulse-soft" /> {t('sync')}: {t('sync.hint')} · rev {s.rev}
        </div>
      </div>

      {resetOpen && (
        <Modal title={t('wipeData')} onClose={() => setResetOpen(false)} footer={
          <>
            <Btn variant="ghost" onClick={() => setResetOpen(false)}>{t('cancel')}</Btn>
            <Btn variant="danger" icon="trash" onClick={() => { actions.replaceAll(seedState()); setResetOpen(false); toast(t('wipeData'), 'warn'); }}>{t('wipeData')}</Btn>
          </>
        }>
          <p className="text-sm text-cream-300">{t('wipeHint')}</p>
        </Modal>
      )}
    </div>
  );
}