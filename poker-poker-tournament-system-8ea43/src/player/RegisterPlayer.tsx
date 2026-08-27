import { useState } from 'react';
import { auth } from '../lib/auth';
import { actions, useApp } from '../lib/store';
import { makeT } from '../lib/i18n';
import { Btn, Field, Icon, ToastHost, toast } from '../components/ui';
import { useNavigate } from 'react-router-dom';

export function RegisterPlayer() {
  const s = useApp();
  const t = makeT(s.settings.language);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError('');
    setLoading(true);

    if (!email || !password || !firstName || !lastName) {
      setError('Заполните все обязательные поля');
      setLoading(false);
      return;
    }

    try {
      // Регистрируем пользователя в Firebase Auth с ролью player
      const result = await auth.register(email, password, 'player', true);
      if (!result.ok) {
        setError(t(result.error));
        setLoading(false);
        return;
      }

      // Добавляем игрока в базу клуба (привязываем userId)
      const playerId = actions.addPlayer({
        firstName,
        lastName,
        nickname: nickname || `${firstName} ${lastName}`,
        phone: phone || '',
        avatarColor: null,
        joinedAt: Date.now(),
        basePoints: 0,
        userId: result.user.id,
      });

      toast(t('player.registerSuccess'));
      setLoading(false);

      // Перенаправляем в личный кабинет
      setTimeout(() => navigate('/player'), 1500);
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-felt suit-pattern flex items-center justify-center p-4">
      <div className="w-full max-w-md anim-rise">
        <div className="text-center mb-6">
          <Icon name="users" size={48} className="mx-auto text-gold-400" filled />
          <h1 className="font-display text-3xl text-cream-100 mt-3">{t('player.register')}</h1>
          <p className="text-xs text-cream-500 mt-1">{t('auth.sub')}</p>
        </div>

        <div className="card p-6 shadow-2xl shadow-black/60">
          <div className="grid gap-3.5">
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('lastName')}>
                <input
                  className="inp"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Иванов"
                />
              </Field>
              <Field label={t('firstName')}>
                <input
                  className="inp"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Иван"
                />
              </Field>
            </div>

            <Field label={t('nickname')}>
              <input
                className="inp"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Никнейм (необязательно)"
              />
            </Field>

            <Field label="Email">
              <input
                className="inp"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@mail.com"
              />
            </Field>

            <Field label={t('auth.password')}>
              <input
                className="inp"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
              />
            </Field>

            <Field label={t('phone')}>
              <input
                className="inp"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 ___ ___-__-__ (необязательно)"
              />
            </Field>

            {error && (
              <div className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2.5 text-xs text-loss font-semibold flex items-center gap-2">
                <Icon name="info" size={14} /> {error}
              </div>
            )}

            <Btn
              variant="gold"
              size="lg"
              icon="play"
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? 'Загрузка...' : t('auth.registerBtn')}
            </Btn>

            <div className="text-center text-xs text-cream-500">
              {t('auth.defaultHint')}
              <br />
              <button
                onClick={() => navigate('/')}
                className="text-gold-300 hover:text-gold-200 font-semibold"
              >
                {t('auth.signIn')}
              </button>
            </div>
          </div>
        </div>
      </div>
      <ToastHost />
    </div>
  );
}