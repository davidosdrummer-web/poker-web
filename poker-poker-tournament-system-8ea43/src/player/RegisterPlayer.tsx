import { useState } from 'react';
import { Btn, Field, Icon, ToastHost, toast } from '../components/ui';
import { auth } from '../lib/auth';
import { actions } from '../lib/store';
import { useApp } from '../lib/store';
import { makeT } from '../lib/i18n';

export function RegisterPlayer() {
  const s = useApp();
  const t = makeT(s.settings.language);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setError('');
    setLoading(true);

    if (!email || !password || !firstName || !lastName) {
      setError('Заполните все обязательные поля');
      setLoading(false);
      return;
    }

    try {
      const result = await auth.register(email, password, 'player', true);
      if (!result.ok) {
        setError(t(result.error));
        setLoading(false);
        return;
      }

      actions.addPlayer({
        firstName,
        lastName,
        nickname: nickname || `${firstName} ${lastName}`,
        phone: phone || '',
        avatarColor: null,
        joinedAt: Date.now(),
        basePoints: 0,
        userId: result.user.id,
      }, true);

      toast('Регистрация успешна!');
      setLoading(false);
      
      // ✅ Просто перезагружаем страницу – это самое надёжное решение
      window.location.reload();
    } catch (err: any) {
      console.error('Ошибка регистрации:', err);
      setError(err.message || 'Ошибка регистрации');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-felt suit-pattern flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Icon name="users" size={48} className="mx-auto text-gold-400" filled />
          <h1 className="font-display text-3xl text-cream-100 mt-3">Регистрация игрока</h1>
          <p className="text-xs text-cream-500 mt-1">Создайте аккаунт для участия в турнирах</p>
        </div>
        <div className="card p-6">
          <div className="grid gap-3.5">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Фамилия">
                <input className="inp" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Иванов" />
              </Field>
              <Field label="Имя">
                <input className="inp" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Иван" />
              </Field>
            </div>
            <Field label="Никнейм">
              <input className="inp" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Никнейм (необязательно)" />
            </Field>
            <Field label="Email">
              <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@mail.com" />
            </Field>
            <Field label="Пароль">
              <input className="inp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
            </Field>
            <Field label="Телефон">
              <input className="inp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 ___ ___-__-__ (необязательно)" />
            </Field>
            {error && (
              <div className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2.5 text-xs text-loss font-semibold flex items-center gap-2">
                <Icon name="info" size={14} /> {error}
              </div>
            )}
            <Btn variant="gold" size="lg" icon="play" onClick={handleRegister} disabled={loading}>
              {loading ? 'Загрузка...' : 'Зарегистрироваться'}
            </Btn>
            <div className="text-center text-xs text-cream-500">
              Уже есть аккаунт?{' '}
              <button onClick={() => window.location.hash = '/'} className="text-gold-300 hover:text-gold-200 font-semibold">
                Войти
              </button>
            </div>
          </div>
        </div>
      </div>
      <ToastHost />
    </div>
  );
}
