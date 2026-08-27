import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { auth, db } from './firebase';
import { ref, set, onValue, push } from 'firebase/database';

const VAPID_KEY = 'ВАШ_VAPID_КЛЮЧ';

export async function requestPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Разрешение на уведомления получено');
      await registerToken();
      return true;
    } else {
      console.log('Разрешение на уведомления отклонено');
      return false;
    }
  } catch (error) {
    console.error('Ошибка запроса разрешения:', error);
    return false;
  }
}

export async function registerToken() {
  try {
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) {
      console.log('FCM Token:', token);
      const user = auth.currentUser;
      if (user) {
        const tokenRef = ref(db, `users/${user.uid}/fcm_tokens/${token}`);
        await set(tokenRef, {
          token,
          createdAt: Date.now(),
          userAgent: navigator.userAgent,
        });
        console.log('Токен сохранён в Firebase');
        return token;
      }
    }
    return null;
  } catch (error) {
    console.error('Ошибка регистрации токена:', error);
    return null;
  }
}

export function listenForMessages() {
  try {
    const messaging = getMessaging();
    onMessage(messaging, (payload) => {
      console.log('Получено уведомление (onMessage):', payload);
      const title = payload.notification?.title || 'Новое уведомление';
      const body = payload.notification?.body || '';
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/poker-icon-192.png',
          badge: '/poker-icon-192.png',
        });
      }
      window.dispatchEvent(new CustomEvent('fcm-message', {
        detail: { title, body, data: payload.data }
      }));
    });
  } catch (error) {
    console.error('Ошибка подписки на уведомления:', error);
  }
}

export async function unregisterToken() {
  try {
    const user = auth.currentUser;
    if (user) {
      const tokensRef = ref(db, `users/${user.uid}/fcm_tokens`);
      await set(tokensRef, null);
      console.log('Все токены удалены');
    }
  } catch (error) {
    console.error('Ошибка удаления токенов:', error);
  }
}