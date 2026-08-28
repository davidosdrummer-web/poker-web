// public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Инициализация Firebase в Service Worker
firebase.initializeApp({
  apiKey: 'AIzaSyCVy9as-EW_lQXIbZdQAcQSqEyKJ1lUpGI',
  authDomain: 'pokerbasa-23592.firebaseapp.com',
  databaseURL: 'https://pokerbasa-23592-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'pokerbasa-23592',
  storageBucket: 'pokerbasa-23592.firebasestorage.app',
  messagingSenderId: '802680795601',
  appId: '1:802680795601:web:0460fd0a33e20fa39830f0',
});

const messaging = firebase.messaging();

// Обработка фоновых уведомлений
messaging.onBackgroundMessage((payload) => {
  console.log('Фоновое уведомление:', payload);
  
  const title = payload.notification?.title || 'Новое уведомление';
  const options = {
    body: payload.notification?.body || '',
    icon: '/poker-icon-192.png',
    badge: '/poker-icon-192.png',
    data: payload.data || {},
  };
  
  self.registration.showNotification(title, options);
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
  console.log('Клик по уведомлению:', event);
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});