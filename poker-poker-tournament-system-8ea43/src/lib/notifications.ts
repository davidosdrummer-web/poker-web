import { getDatabase, ref, get } from 'firebase/database';
import { db } from './firebase';

export interface NotificationData {
  title: string;
  body: string;
  type: 'level' | 'break' | 'eliminate' | 'rebuy' | 'reentry' | 'addon' | 'start' | 'end';
  tournamentId?: string;
  timestamp: number;
}

export async function sendNotification(notification: NotificationData) {
  try {
    const newRef = ref(db, `notifications/outbox/${Date.now()}`);
    await set(newRef, {
      ...notification,
      sent: false,
      timestamp: Date.now(),
    });
    console.log('Уведомление добавлено в очередь:', notification);
    return true;
  } catch (error) {
    console.error('Ошибка сохранения уведомления:', error);
    return false;
  }
}

export async function getUserTokens(userId: string): Promise<string[]> {
  try {
    const tokensRef = ref(db, `users/${userId}/fcm_tokens`);
    const snapshot = await get(tokensRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.keys(data).map(key => data[key].token);
    }
    return [];
  } catch (error) {
    console.error('Ошибка получения токенов:', error);
    return [];
  }
}

export async function getAllTokens(): Promise<{ userId: string; tokens: string[] }[]> {
  try {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      const result: { userId: string; tokens: string[] }[] = [];
      for (const uid in data) {
        if (data[uid].fcm_tokens) {
          const tokens = Object.keys(data[uid].fcm_tokens).map(
            key => data[uid].fcm_tokens[key].token
          );
          if (tokens.length > 0) {
            result.push({ userId: uid, tokens });
          }
        }
      }
      return result;
    }
    return [];
  } catch (error) {
    console.error('Ошибка получения всех токенов:', error);
    return [];
  }
}