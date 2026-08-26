// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  off,
} from 'firebase/database';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';

// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
// 1. Конфигурация Firebase (скопируйте из консоли)
// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
const firebaseConfig = {
  apiKey: "AIzaSyCVy9as-EW_lQXIbZdQAcQSqEyKJ1lUpGI",
  authDomain: "pokerbasa-23592.firebaseapp.com",
  databaseURL: "https://pokerbasa-23592-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "pokerbasa-23592",
  storageBucket: "pokerbasa-23592.firebasestorage.app",
  messagingSenderId: "802680795601",
  appId: "1:802680795601:web:0460fd0a33e20fa39830f0",
  // measurementId не обязателен для работы, его можно добавить, но он не используется в коде
  // measurementId: "G-R4MMYKJJ3M"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
// 2. Текущий пользователь (синхронный доступ)
// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
let currentUserId: string | null = null;

onAuthStateChanged(auth, (user) => {
  currentUserId = user?.uid || null;
});

export function getUserId(): string | null {
  return currentUserId;
}

// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
// 3. Функции аутентификации (email/password)
// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
export async function loginWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function registerWithEmail(email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
// 4. Работа с ролью в Realtime Database
// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
export async function getUserRole(uid: string): Promise<string | null> {
  const roleRef = ref(db, `users/${uid}/role`);
  const snapshot = await get(roleRef);
  return snapshot.exists() ? snapshot.val() : null;
}

export async function setUserRole(uid: string, role: string) {
  await set(ref(db, `users/${uid}/role`), role);
}

// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
// 5. Экспорт функций БД для удобства
// ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
export { ref, set, get, onValue, off };