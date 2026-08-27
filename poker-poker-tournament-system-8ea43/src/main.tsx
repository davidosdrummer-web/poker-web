import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { initStore } from './lib/store';

const root = ReactDOM.createRoot(document.getElementById('root')!);

// Показываем загрузку
root.render(
  <div className="flex items-center justify-center h-screen text-cream-500">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <div className="text-sm">Загрузка...</div>
    </div>
  </div>
);

onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Пользователь авторизован – загружаем его данные из БД
    await initStore();
    root.render(<App />);
  } else {
    // Не авторизован – показываем приложение, AuthGate попросит войти
    root.render(<App />);
  }
});