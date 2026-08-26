import { useMemo, useState } from 'react';
import type { Player, PlayerStatus } from '../lib/types';
import { actions, can, useApp } from '../lib/store';
import { makeT } from '../lib/i18n';
import { fmtDate, fullName, leaderboardRows, rankMap } from '../lib/utils';
import { Avatar, Badge, Btn, EmptyState, Field, Icon, Modal, toast } from '../components/ui';

const AVATAR_COLORS = [null, '#b9881f', '#8a3d3d', '#3d6b8a', '#4a7a4f', '#7a4a74', '#8a6a3d', '#3d8a83', '#5b5b8a'];

export function PlayersTab() {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | PlayerStatus>('all');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const allowed = can('players');
  const delPlayer = delId ? s.players.find((p) => p.id === delId) ?? null : null;

  const rows = useMemo(() => leaderboardRows(s.players, s.tournaments, null), [s.players, s.tournaments]);
  const ranks = useMemo(() => rankMap(rows), [rows]);
  const statsOf = useMemo(() => new Map(rows.map((r) => [r.playerId, r])), [rows]);

  const list = s.players
    .filter((p) => (filter === 'all' ? true : p.status === filter))
    .filter((p) => `${p.firstName} ${p.lastName} ${p.nickname} ${p.phone}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (statsOf.get(b.id)?.points ?? 0) - (statsOf.get(a.id)?.points ?? 0) || a.lastName.localeCompare(b.lastName, 'ru'));

  const filters: { id: 'all' | PlayerStatus; label: string }[] = [
    { id: 'all', label: t('filter.all') },
    { id: 'active', label: t('filter.active') },
    { id: 'blocked', label: t('filter.blocked') },
    { id: 'archived', label: t('filter.archived') },
  ];

  const profile = profileId ? s.players.find((p) => p.id === profileId) ?? null : null;

  return (
    <div className="anim-rise">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-3xl text-cream-100">{t('nav.players')}</h2>
          <p className="text-xs text-cream-500 mt-0.5 num">{s.players.length} · {t('masterList')}</p>
        </div>
        {allowed && <Btn variant="gold" icon="plus" onClick={() => setAddOpen(true)}>{t('addPlayer')}</Btn>}
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-700" />
          <input className="inp !pl-9 !w-64" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-felt-900 border border-line rounded-lg p-1">
          {filters.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${filter === f.id ? 'bg-gold-400 text-felt-950' : 'text-cream-500 hover:text-cream-100'}`}>
              {f.label}
            </button>
          ))}
        </div>
        {!allowed && <span className="text-xs text-loss font-semibold flex items-center gap-1.5"><Icon name="info" size={13} /> {t('readOnly')}</span>}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-cream-500 border-b border-line-soft">
              <th className="px-4 py-2.5 font-bold">{t('rank')}</th>
              <th className="px-3 py-2.5 font-bold">{t('nickname')}</th>
              <th className="px-3 py-2.5 font-bold">{t('nav.players')}</th>
              <th className="px-3 py-2.5 font-bold">{t('phone')}</th>
              <th className="px-3 py-2.5 font-bold">{t('memberSince')}</th>
              <th className="px-3 py-2.5 font-bold text-right">{t('totalPoints')}</th>
              <th className="px-3 py-2.5 font-bold text-right">{t('played')}</th>
              <th className="px-3 py-2.5 font-bold text-right">{t('wins')}</th>
              <th className="px-3 py-2.5 font-bold text-right">{t('top3')}</th>
              <th className="px-3 py-2.5 font-bold text-right">{t('best')}</th>
              <th className="px-3 py-2.5 font-bold w-20"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const st = statsOf.get(p.id);
              const rank = ranks.get(p.id);
              return (
                <tr key={p.id} className="border-b border-line-soft/60 last:border-0 hover:bg-felt-800/40 cursor-pointer transition-colors" onClick={() => setProfileId(p.id)}>
                  <td className="px-4 py-2">
                    <span className={`font-display text-lg num ${rank === 1 ? 'text-gold-300' : rank === 2 ? 'text-[#dbe2e8]' : rank === 3 ? 'text-[#e0a86b]' : 'text-cream-700'}`}>{rank ? `#${rank}` : '—'}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-gold-400/10 border border-gold-400/25 px-2 py-0.5 text-xs font-bold text-gold-300 max-w-[140px]">
                      <span className="truncate">{p.nickname || '—'}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={fullName(p)} color={p.avatarColor} avatarData={p.avatarData ?? null} size={30} />
                      <div className="min-w-0">
                        <div className={`font-semibold truncate ${p.status !== 'active' ? 'text-cream-500 line-through decoration-1' : ''}`}>{fullName(p)}</div>
                      </div>
                      {p.status === 'blocked' && <Badge tone="red">{t('status.blocked')}</Badge>}
                      {p.status === 'archived' && <Badge tone="neutral">{t('status.archived')}</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2 num text-cream-500">{p.phone}</td>
                  <td className="px-3 py-2 num text-cream-500">{fmtDate(p.joinedAt, s.settings.language)}</td>
                  <td className="px-3 py-2 text-right font-display text-lg num text-gold-300">{st?.points ?? 0}</td>
                  <td className="px-3 py-2 text-right num text-cream-300">{st?.played ?? 0}</td>
                  <td className="px-3 py-2 text-right num text-cream-300">{st?.wins ?? 0}</td>
                  <td className="px-3 py-2 text-right num text-cream-300">{st?.top3 ?? 0}</td>
                  <td className="px-3 py-2 text-right num text-cream-300">{st?.best ?? 0}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {allowed && p.status === 'active' && (
                        <button className="p-1.5 rounded-md text-cream-500 hover:text-loss hover:bg-loss/10 transition-colors" title={t('block')} onClick={() => { actions.setPlayerStatus(p.id, 'blocked'); toast(t('block'), 'warn'); }}>
                          <Icon name="x" size={14} />
                        </button>
                      )}
                      {allowed && p.status === 'blocked' && (
                        <button className="p-1.5 rounded-md text-cream-500 hover:text-win hover:bg-win/10 transition-colors" title={t('unblock')} onClick={() => actions.setPlayerStatus(p.id, 'active')}>
                          <Icon name="check" size={14} />
                        </button>
                      )}
                      {allowed && p.status !== 'archived' && (
                        <button className="p-1.5 rounded-md text-cream-500 hover:text-gold-300 hover:bg-gold-400/10 transition-colors" title={t('archive')} onClick={() => actions.setPlayerStatus(p.id, 'archived')}>
                          <Icon name="download" size={14} />
                        </button>
                      )}
                      {allowed && p.status === 'archived' && (
                        <button className="p-1.5 rounded-md text-cream-500 hover:text-win hover:bg-win/10 transition-colors" title={t('restore')} onClick={() => actions.setPlayerStatus(p.id, 'active')}>
                          <Icon name="refresh" size={14} />
                        </button>
                      )}
                      {allowed && (
                        <button className="p-1.5 rounded-md text-cream-500 hover:text-loss hover:bg-loss/10 transition-colors" title={t('deletePlayer')} onClick={() => setDelId(p.id)}>
                          <Icon name="trash" size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <EmptyState icon="users" text={t('empty')} />}
      </div>

      {profile && <PlayerProfile player={profile} onClose={() => setProfileId(null)} />}
      {addOpen && <PlayerForm onClose={() => setAddOpen(false)} />}
      {delPlayer && (
        <Modal title={t('deletePlayer')} onClose={() => setDelId(null)} footer={
          <>
            <Btn variant="ghost" onClick={() => setDelId(null)}>{t('cancel')}</Btn>
            <Btn variant="danger" icon="trash" onClick={() => { actions.deletePlayer(delPlayer.id); setDelId(null); setProfileId(null); toast(t('playerDeleted'), 'warn'); }}>
              {t('delete')}
            </Btn>
          </>
        }>
          <div className="flex items-center gap-3 mb-3">
            <Avatar name={fullName(delPlayer)} color={delPlayer.avatarColor} avatarData={delPlayer.avatarData ?? null} size={40} />
            <div>
              <div className="font-bold">{fullName(delPlayer)}</div>
              <div className="text-xs text-cream-500">«{delPlayer.nickname}»</div>
            </div>
          </div>
          <p className="text-sm text-cream-300">{t('confirmDeleteP')}</p>
        </Modal>
      )}
    </div>
  );
}

function PlayerProfile({ player, onClose }: { player: Player; onClose: () => void }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const allowed = can('players');
  const [form, setForm] = useState({ firstName: player.firstName, lastName: player.lastName, nickname: player.nickname, phone: player.phone, avatarColor: player.avatarColor, avatarData: player.avatarData ?? null, joinedAt: player.joinedAt });

  const rows = useMemo(() => leaderboardRows(s.players, s.tournaments, null), [s.players, s.tournaments]);
  const st = rows.find((r) => r.playerId === player.id);
  const rank = rankMap(rows).get(player.id);
  const history = s.tournaments
    .filter((tor) => tor.status === 'finished' && tor.entries.some((e) => e.playerId === player.id))
    .sort((a, b) => b.date - a.date);

  return (
    <Modal wide title={t('editPlayer')} onClose={onClose} footer={
      <>
        <Btn variant="ghost" onClick={onClose}>{t('close')}</Btn>
        {allowed && <Btn variant="gold" icon="check" onClick={() => { actions.updatePlayer(player.id, form); toast(t('save')); onClose(); }}>{t('save')}</Btn>}
      </>
    }>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={`${form.firstName} ${form.lastName}`.trim() || '?'} color={form.avatarColor} avatarData={form.avatarData} size={56} />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-cream-700 font-bold">{t('playerId')}</div>
              <div className="text-xs num text-cream-500">{player.id}</div>
            </div>
            {allowed && (
              <label className="ml-auto cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold text-gold-300 hover:text-gold-200 border border-gold-400/30 bg-gold-400/8 rounded-lg px-2.5 py-1.5 transition-colors shrink-0">
                <Icon name="upload" size={13} /> {t('avatarUpload')}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readAvatar(f, (data, err) => { if (data) setForm({ ...form, avatarData: data }); if (err) toast(t(err), 'err'); });
                  e.target.value = '';
                }} />
              </label>
            )}
            {allowed && form.avatarData && (
              <button className="text-[11px] text-cream-500 hover:text-loss font-semibold shrink-0" onClick={() => setForm({ ...form, avatarData: null })}>{t('avatarRemove')}</button>
            )}
          </div>
          <Field label={t('lastName')}><input className="inp" value={form.lastName} disabled={!allowed} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
          <Field label={t('firstName')}><input className="inp" value={form.firstName} disabled={!allowed} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
          <Field label={t('nickname')}><input className="inp" value={form.nickname} disabled={!allowed} onChange={(e) => setForm({ ...form, nickname: e.target.value })} /></Field>
          <Field label={t('phone')}><input className="inp" value={form.phone} disabled={!allowed} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label={t('joinedAt')}>
            <input type="date" className="inp num" value={toDateInput(form.joinedAt)} disabled={!allowed} onChange={(e) => { const ts = new Date(e.target.value).getTime(); if (!Number.isNaN(ts)) setForm({ ...form, joinedAt: ts }); }} />
          </Field>
          <Field label={t('startPoints')}>
            <div className="inp num flex items-center justify-between !text-cream-500">
              <span>{player.basePoints ?? 0}</span>
              <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-cream-700 border border-line-soft rounded px-1 py-0.5">{t('lockedShort') || 'LOCK'}</span>
            </div>
            <span className="block text-[11px] text-cream-700 mt-1.5">{t('startPointsLocked')}</span>
          </Field>
          <Field label={`${t('avatarColor')} · ${t('auto')}`}>
            <div className="flex gap-1.5 flex-wrap pt-1">
              {AVATAR_COLORS.map((c, i) => (
                <button key={i} disabled={!allowed} onClick={() => setForm({ ...form, avatarColor: c })} className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 disabled:opacity-40 ${form.avatarColor === c ? 'border-cream-100 scale-110' : 'border-transparent'}`} style={{ background: c ?? `conic-gradient(from 40deg, #b9881f, #3d6b8a, #4a7a4f, #b9881f)` }} title={c ?? t('auto')} />
              ))}
            </div>
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-cream-500 font-bold mb-2">{t('career')}</div>
            <div className="grid grid-cols-3 gap-2">
              <CareerCell label={t('rank')} value={rank ? `#${rank}` : '—'} gold />
              <CareerCell label={t('totalPoints')} value={String(st?.points ?? 0)} gold />
              <CareerCell label={t('played')} value={String(st?.played ?? 0)} />
              <CareerCell label={t('wins')} value={String(st?.wins ?? 0)} />
              <CareerCell label={t('top3')} value={String(st?.top3 ?? 0)} />
              <CareerCell label={t('finals')} value={String(st?.finals ?? 0)} />
              <CareerCell label={t('best')} value={String(st?.best ?? 0)} />
              <CareerCell label={t('winRate')} value={st && st.played > 0 ? `${Math.round((st.wins / st.played) * 100)}%` : '—'} />
              <CareerCell label={t('avgPoints')} value={st && st.played > 0 ? (st.points / st.played).toFixed(1) : '—'} />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-cream-500 font-bold mb-2">{t('tournamentHistory')}</div>
            <div className="flex flex-col gap-1 max-h-[24vh] overflow-y-auto pr-1">
              {history.map((tor) => {
                const e = tor.entries.find((x) => x.playerId === player.id)!;
                return (
                  <div key={tor.id} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-felt-900/50 px-3 py-1.5 text-xs">
                    <span className={`font-display text-base num w-8 ${e.place === 1 ? 'text-gold-300' : e.place! <= 3 ? 'text-[#e0a86b]' : 'text-cream-500'}`}>{e.place}.</span>
                    <span className="flex-1 truncate font-semibold">{tor.name}</span>
                    <span className="num text-cream-700">{fmtDate(tor.date, s.settings.language)}</span>
                    <span className="num font-bold text-gold-300">+{e.points} {t('pts')}</span>
                  </div>
                );
              })}
              {history.length === 0 && <div className="text-xs text-cream-700 italic py-1">{t('noHistory')}</div>}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CareerCell({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-lg border border-line-soft bg-felt-900/50 px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wider text-cream-700 font-bold">{label}</div>
      <div className={`font-display text-xl num ${gold ? 'text-gold-300' : 'text-cream-100'}`}>{value}</div>
    </div>
  );
}

function toDateInput(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** читает файл как dataURL, ограничивая размер ~400 КБ */
function readAvatar(file: File, cb: (data: string | null, err: string | null) => void) {
  if (file.size > 400 * 1024) {
    cb(null, 'avatarTooBig');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => cb(String(reader.result), null);
  reader.onerror = () => cb(null, 'avatarTooBig');
  reader.readAsDataURL(file);
}

function PlayerForm({ onClose }: { onClose: () => void }) {
  const t = makeT(useApp().settings.language);
  const [form, setForm] = useState({ firstName: '', lastName: '', nickname: '', phone: '', avatarColor: null as string | null });
  const [joinedAt, setJoinedAt] = useState(Date.now());
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [basePoints, setBasePoints] = useState(0);
  const valid = form.firstName.trim() && form.lastName.trim();
  return (
    <Modal title={t('addPlayer')} onClose={onClose} footer={
      <>
        <Btn variant="ghost" onClick={onClose}>{t('cancel')}</Btn>
        <Btn variant="gold" icon="plus" disabled={!valid} onClick={() => {
          actions.addPlayer({
            ...form,
            nickname: form.nickname.trim() || form.firstName.trim(),
            avatarData,
            joinedAt,
            basePoints,
          });
          toast(t('addPlayer'));
          onClose();
        }}>{t('save')}</Btn>
      </>
    }>
      <div className="grid gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={`${form.firstName} ${form.lastName}`.trim() || '?'} color={form.avatarColor} avatarData={avatarData} size={52} />
          <label className="cursor-pointer inline-flex items-center gap-2 text-sm font-semibold text-gold-300 hover:text-gold-200 border border-gold-400/30 bg-gold-400/8 rounded-lg px-3 py-2 transition-colors">
            <Icon name="upload" size={15} /> {t('avatarUpload')}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readAvatar(f, (data, err) => { if (data) setAvatarData(data); if (err) toast(t(err), 'err'); });
              e.target.value = '';
            }} />
          </label>
          {avatarData && (
            <button className="text-xs text-cream-500 hover:text-loss font-semibold" onClick={() => setAvatarData(null)}>{t('avatarRemove')}</button>
          )}
        </div>
        <Field label={t('lastName')}><input className="inp" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} autoFocus /></Field>
        <Field label={t('firstName')}><input className="inp" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
        <Field label={t('nickname')}><input className="inp" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} /></Field>
        <Field label={t('phone')}><input className="inp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+7 ___ ___-__-__" /></Field>
        <Field label={t('joinedAt')}>
          <input type="date" className="inp num" value={toDateInput(joinedAt)} onChange={(e) => { const ts = new Date(e.target.value).getTime(); if (!Number.isNaN(ts)) setJoinedAt(ts); }} />
        </Field>
        <Field label={t('startPoints')}>
          <input className="inp num" type="number" value={basePoints} onChange={(e) => setBasePoints(Math.max(0, Number(e.target.value) || 0))} />
          <span className="block text-[11px] text-cream-700 mt-1.5 flex items-center gap-1.5"><Icon name="info" size={12} /> {t('startPointsHint')}</span>
        </Field>
      </div>
    </Modal>
  );
}
