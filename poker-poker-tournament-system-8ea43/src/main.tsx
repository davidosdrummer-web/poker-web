// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { initStore } from './lib/store';

const root = ReactDOM.createRoot(document.getElementById('root')!);

// Показываем загрузку (можно заменить на спиннер)
root.render(<div className="flex items-center justify-center h-screen text-cream-500">Загрузка...</div>);

onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Пользователь авторизован – загружаем его данные из БД
    await initStore();
    root.render(<App />);
  } else {
    // Не авторизован – показываем приложение, но AuthGate в нём попросит войти
    root.render(<App />);
  }
});
