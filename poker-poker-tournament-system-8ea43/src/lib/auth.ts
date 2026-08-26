// src/lib/auth.ts
import { useSyncExternalStore } from 'react';
import type { Role } from './types';
import {
  auth as firebaseAuth,
  loginWithEmail,
  registerWithEmail,
  logout as firebaseLogout,
  getUserRole,
  setUserRole,
  getUserId,
  db,
  ref,
  onValue,
  set,
  get,
} from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
// Интерфейс пользователя (совместим со старым)
// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
export interface UserAccount {
  id: string;
  username: string;   // email или displayName
  role: Role;
  createdAt: number;
}

// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
// Состояние текущего пользователя
// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
let currentUser: UserAccount | null = null;
let currentFirebaseUser: User | null = null;
const listeners = new Set<() => void>();

// Асинхронное обновление пользователя (читает роль из БД)
async function updateCurrentUser(firebaseUser: User | null) {
  if (!firebaseUser) {
    currentUser = null;
    currentFirebaseUser = null;
    listeners.forEach((l) => l());
    return;
  }
  currentFirebaseUser = firebaseUser;
  const uid = firebaseUser.uid;
  const role = (await getUserRole(uid)) as Role || 'operator'; // по умолчанию operator
  const email = firebaseUser.email || 'user';
  const username = firebaseUser.displayName || email.split('@')[0] || 'user';
  currentUser = {
    id: uid,
    username,
    role,
    createdAt: firebaseUser.metadata.creationTime
      ? new Date(firebaseUser.metadata.creationTime).getTime()
      : Date.now(),
  };
  listeners.forEach((l) => l());
}

// Подписка на изменения состояния Firebase Auth
onAuthStateChanged(firebaseAuth, (user) => {
  updateCurrentUser(user);
});

// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
// Синхронный доступ к текущему пользователю
// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
function getSnapshot(): UserAccount | null {
  return currentUser;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function useAuth(): UserAccount | null {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function currentRole(): Role | null {
  return currentUser?.role ?? null;
}

// Тип результата операций
export type AuthResult = { ok: true; user: UserAccount } | { ok: false; error: string };

// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
// Состояние списка всех пользователей (для админа)
// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
let allUsers: UserAccount[] = [];
const userListeners = new Set<() => void>();

// Загрузка списка пользователей из базы
function loadAllUsers() {
  const usersRef = ref(db, 'users');
  onValue(usersRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const users: UserAccount[] = [];
      for (const uid in data) {
        const u = data[uid];
        users.push({
          id: uid,
          username: u.email || uid,
          role: u.role || 'operator',
          createdAt: u.createdAt || Date.now(),
        });
      }
      allUsers = users;
    } else {
      allUsers = [];
    }
    userListeners.forEach((l) => l());
  });
}
loadAllUsers();

// Синхронный доступ к списку пользователей
function getUsersSnapshot(): UserAccount[] {
  return allUsers;
}

function subscribeUsers(callback: () => void): () => void {
  userListeners.add(callback);
  return () => userListeners.delete(callback);
}

export function useAllUsers(): UserAccount[] {
  return useSyncExternalStore(subscribeUsers, getUsersSnapshot);
}

// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
// API для компонентов (все методы асинхронны)
// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
export const auth = {
  async login(username: string, password: string): Promise<AuthResult> {
    try {
      await loginWithEmail(username, password);
      const user = currentUser;
      if (user) return { ok: true, user };
      await new Promise((resolve) => setTimeout(resolve, 300));
      const userAfter = currentUser;
      if (userAfter) return { ok: true, user: userAfter };
      return { ok: false, error: 'auth.noUser' };
    } catch (err: any) {
      let errorMsg = 'auth.wrongCreds';
      if (err.code === 'auth/user-not-found') errorMsg = 'auth.userNotFound';
      else if (err.code === 'auth/wrong-password') errorMsg = 'auth.wrongPassword';
      else if (err.code === 'auth/invalid-email') errorMsg = 'auth.invalidEmail';
      return { ok: false, error: errorMsg };
    }
  },

  async register(
    username: string,
    password: string,
    role: Role,
    autoLogin = true,
  ): Promise<AuthResult> {
    try {
      const user = await registerWithEmail(username, password);
      await setUserRole(user.uid, role);
      if (autoLogin) {
        await updateCurrentUser(user);
      }
      const newUser: UserAccount = {
        id: user.uid,
        username: user.email || username,
        role,
        createdAt: Date.now(),
      };
      return { ok: true, user: newUser };
    } catch (err: any) {
      let errorMsg = 'auth.registerError';
      if (err.code === 'auth/email-already-in-use') errorMsg = 'auth.userExists';
      else if (err.code === 'auth/invalid-email') errorMsg = 'auth.invalidEmail';
      else if (err.code === 'auth/weak-password') errorMsg = 'auth.weakPassword';
      return { ok: false, error: errorMsg };
    }
  },

  async logout() {
    await firebaseLogout();
  },

  // --- Управление операторами ---

  /** Возвращает список всех пользователей (синхронно для обратной совместимости) */
  listAccounts(): UserAccount[] {
    return allUsers;
  },

  async createOperator(username: string, password: string, byAdmin: UserAccount): Promise<AuthResult> {
    if (byAdmin.role !== 'admin') return { ok: false, error: 'auth.noRights' };
    try {
      // Сначала регистрируем пользователя в Firebase Auth
      const userCred = await registerWithEmail(username, password);
      // Записываем роль и email в БД
      await set(ref(db, `users/${userCred.user.uid}`), {
        email: username,
        role: 'operator',
        createdAt: Date.now(),
      });
      const newUser: UserAccount = {
        id: userCred.user.uid,
        username: userCred.user.email || username,
        role: 'operator',
        createdAt: Date.now(),
      };
      // Не обновляем текущую сессию (autoLogin = false)
      return { ok: true, user: newUser };
    } catch (err: any) {
      let errorMsg = 'auth.registerError';
      if (err.code === 'auth/email-already-in-use') errorMsg = 'auth.userExists';
      else if (err.code === 'auth/invalid-email') errorMsg = 'auth.invalidEmail';
      else if (err.code === 'auth/weak-password') errorMsg = 'auth.weakPassword';
      return { ok: false, error: errorMsg };
    }
  },

  async deleteAccount(id: string, byAdmin: UserAccount): Promise<AuthResult> {
    if (byAdmin.role !== 'admin') return { ok: false, error: 'auth.noRights' };
    const target = allUsers.find((u) => u.id === id);
    if (!target) return { ok: false, error: 'auth.noUser' };
    if (target.id === byAdmin.id) return { ok: false, error: 'auth.cannotDeleteSelf' };
    if (target.role === 'admin') return { ok: false, error: 'auth.lastAdmin' };
    try {
      // Удаляем запись из базы (сам аккаунт Firebase остаётся, но без роли он бесполезен)
      await set(ref(db, `users/${id}`), null);
      return { ok: true, user: byAdmin };
    } catch {
      return { ok: false, error: 'auth.deleteError' };
    }
  },

  // --- Изменение логина и пароля (заглушки, требующие дополнительной реализации) ---

  async changeUsername(current: UserAccount, newUsername: string, password: string): Promise<AuthResult> {
    // Реализация требует обновления email в Firebase Auth (с подтверждением)
    return { ok: false, error: 'auth.notSupported' };
  },

  async changePassword(current: UserAccount, oldPass: string, newPass: string): Promise<AuthResult> {
    // Требует повторной аутентификации
    return { ok: false, error: 'auth.notSupported' };
  },
};

// Для обратной совместимости
export { currentUser as currentUser };