import { useState } from 'react';
import { auth, useAuth, type UserAccount } from '../lib/auth';
import { actions, useApp } from '../lib/store';
import { makeT } from '../lib/i18n';
import { Badge, Btn, ClubLogo, Field, Icon, Modal, toast } from '../components/ui';

/* ---------------- экран входа / регистрации ---------------- */

export function AuthGate() {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    const res = await auth.login(username, password);
    if (!res.ok) {
      setError(t(res.error));
      return;
    }
    actions.setRole(res.user.role);
    toast(`${t('loggedInAs')} ${res.user.username}`);
  };

  return (
    <div className="min-h-screen bg-felt suit-pattern flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 240px rgba(0,0,0,0.7)' }} />
      <div className="absolute -top-24 -right-24 opacity-[0.05] anim-spin-slow pointer-events-none">
        <Icon name="spade" size={420} filled className="text-gold-400" />
      </div>
      <div className="absolute -bottom-32 -left-28 opacity-[0.04] pointer-events-none rotate-12">
        <Icon name="club" size={400} filled className="text-cream-100" />
      </div>

      <div className="relative w-full max-w-md anim-rise">
        <div className="flex flex-col items-center mb-6">
          <ClubLogo logo={s.settings.logo} size={64} accent={s.settings.accent} />
          <h1 className="font-display text-5xl text-cream-100 mt-4 tracking-wide">{s.settings.clubName}</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-500 font-bold mt-1">{t('auth.welcome')}</p>
          <p className="text-xs text-cream-500 mt-1">{t('auth.sub')}</p>
        </div>

        <div className="card p-6 shadow-2xl shadow-black/60">
          <div className="flex items-center gap-2 mb-5">
            <Icon name="users" size={16} className="text-gold-400" />
            <span className="font-display text-xl text-gold-300 tracking-wide">{t('auth.signIn')}</span>
          </div>
          <div className="grid gap-3.5">
            <Field label={t('auth.username')}>
              <input className="inp !py-2.5" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
            </Field>
            <Field label={t('auth.password')}>
              <input className="inp !py-2.5" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="••••••" />
            </Field>
            {error && (
              <div className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2.5 text-xs text-loss font-semibold flex items-center gap-2">
                <Icon name="info" size={14} /> {error}
              </div>
            )}
            <Btn variant="gold" size="lg" icon="play" onClick={submit}>
              {t('auth.loginBtn')}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- личный кабинет ---------------- */

export function AccountModal({ user, onClose }: { user: UserAccount; onClose: () => void }) {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [tab, setTab] = useState<'login' | 'password'>('login');
  const [newLogin, setNewLogin] = useState(user.username);
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  /* управление операторами (только админ) */
  const [accVersion, setAccVersion] = useState(0);
  const accountsList = auth.listAccounts();
  void accVersion;
  const [opLogin, setOpLogin] = useState('');
  const [opPass, setOpPass] = useState('');
  const [opError, setOpError] = useState('');

  const addOperator = async () => {
    setOpError('');
    const res = await auth.createOperator(opLogin, opPass, user);
    if (!res.ok) {
      setOpError(t(res.error));
      return;
    }
    setOpLogin('');
    setOpPass('');
    setAccVersion((v) => v + 1);
    toast(t('operatorAdded'));
  };

  const removeAccount = async (id: string) => {
    const res = await auth.deleteAccount(id, user);
    if (!res.ok) {
      setOpError(t(res.error));
      return;
    }
    setOpError('');
    setAccVersion((v) => v + 1);
    toast(t('operatorDeleted'), 'warn');
  };

  const save = async () => {
    setError('');
    if (tab === 'login') {
      const res = await auth.changeUsername(user, newLogin, curPass);
      if (!res.ok) return setError(t(res.error));
      actions.setRole(res.user.role);
      toast(t('loginChanged'));
      setCurPass('');
    } else {
      if (newPass !== confirm) return setError(t('passMismatch'));
      const res = await auth.changePassword(user, curPass, newPass);
      if (!res.ok) return setError(t(res.error));
      toast(t('passwordChanged'));
      setCurPass('');
      setNewPass('');
      setConfirm('');
    }
  };

  return (
    <Modal title={t('account')} onClose={onClose} footer={
      <>
        <Btn variant="ghost" onClick={onClose}>{t('close')}</Btn>
        <Btn variant="gold" icon="check" disabled={tab === 'password' && (!newPass || !confirm)} onClick={save}>{t('save')}</Btn>
      </>
    }>
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-line-soft">
        <div className="w-12 h-12 rounded-full bg-gold-400/15 border border-gold-400/30 flex items-center justify-center font-display text-2xl text-gold-300 uppercase">
          {user.username.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <div className="font-bold truncate">{user.username}</div>
          <div className="text-[11px] text-cream-500">{t(`role.${user.role}`)} · {t('memberSinceAcc')} {new Date(user.createdAt).toLocaleDateString(s.settings.language === 'ru' ? 'ru-RU' : 'en-GB')}</div>
        </div>
      </div>

      <div className="flex gap-1 bg-felt-900 border border-line rounded-lg p-1 mb-4">
        {(['login', 'password'] as const).map((m) => (
          <button key={m} onClick={() => { setTab(m); setError(''); }} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors ${tab === m ? 'bg-gold-400 text-felt-950' : 'text-cream-500 hover:text-cream-100'}`}>
            {t(m === 'login' ? 'changeLogin' : 'changePassword')}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {tab === 'login' ? (
          <Field label={t('newLogin')}><input className="inp" value={newLogin} onChange={(e) => setNewLogin(e.target.value)} /></Field>
        ) : (
          <>
            <Field label={t('newPassword')}><input className="inp" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} /></Field>
            <Field label={t('confirmNewPassword')}><input className="inp" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          </>
        )}
        <Field label={t('currentPassword')}><input className="inp" type="password" value={curPass} onChange={(e) => setCurPass(e.target.value)} placeholder="••••••" /></Field>
        {error && (
          <div className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-xs text-loss font-semibold flex items-center gap-2">
            <Icon name="info" size={13} /> {error}
          </div>
        )}
      </div>

      {user.role === 'admin' && (
        <div className="mt-5 pt-4 border-t border-line-soft">
          <div className="flex items-center gap-2 mb-1.5">
            <Icon name="users" size={15} className="text-gold-400" />
            <span className="font-display text-lg text-gold-300">{t('operators')}</span>
          </div>
          <p className="text-[11px] text-cream-500 mb-3">{t('operatorsHint')}</p>

          <div className="flex flex-col gap-1.5 mb-3">
            {accountsList.map((a) => (
              <div key={a.id} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-felt-900/50 px-3 py-2 text-sm">
                <div className="w-7 h-7 rounded-md bg-gold-400/12 border border-gold-400/25 flex items-center justify-center font-display text-sm text-gold-300 uppercase shrink-0">
                  {a.username.slice(0, 1)}
                </div>
                <span className="flex-1 font-semibold truncate">{a.username}</span>
                <Badge tone={a.role === 'admin' ? 'gold' : 'info'}>{t(`role.${a.role}`)}</Badge>
                {a.role === 'operator' && (
                  <button className="p-1 rounded text-cream-700 hover:text-loss hover:bg-loss/10 transition-colors" title={t('delete')} onClick={() => removeAccount(a.id)}>
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input className="inp" placeholder={t('auth.username')} value={opLogin} onChange={(e) => setOpLogin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addOperator()} />
            <input className="inp" type="password" placeholder={t('auth.password')} value={opPass} onChange={(e) => setOpPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addOperator()} />
            <Btn icon="plus" disabled={!opLogin.trim() || !opPass} onClick={addOperator}>{t('addOperator')}</Btn>
          </div>
          {opError && (
            <div className="mt-2 rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-xs text-loss font-semibold flex items-center gap-2">
              <Icon name="info" size={13} /> {opError}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export function useAuthUser() {
  return useAuth();
}