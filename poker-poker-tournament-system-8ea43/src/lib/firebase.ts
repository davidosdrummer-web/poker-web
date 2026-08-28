import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, off, push, update } from 'firebase/database';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User } from 'firebase/auth';
import type { Player } from './types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

let currentUserId: string | null = null;

onAuthStateChanged(auth, (user) => {
  currentUserId = user?.uid || null;
});

export function getUserId(): string | null {
  return currentUserId;
}

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

export async function getUserRole(uid: string): Promise<string | null> {
  const roleRef = ref(db, `users/${uid}/role`);
  const snapshot = await get(roleRef);
  return snapshot.exists() ? snapshot.val() : null;
}

export async function setUserRole(uid: string, role: string) {
  await set(ref(db, `users/${uid}/role`), role);
}

// === Players Management in Firebase ===

/** Save player to common players list in Firebase */
export async function savePlayerToFirebase(player: Player): Promise<void> {
  await set(ref(db, `players/${player.id}`), player);
}

/** Update player data in Firebase */
export async function updatePlayerInFirebase(playerId: string, patch: Partial<Player>): Promise<void> {
  await update(ref(db, `players/${playerId}`), patch);
}

/** Delete player from Firebase */
export async function deletePlayerFromFirebase(playerId: string): Promise<void> {
  await set(ref(db, `players/${playerId}`), null);
}

/** Get all players from Firebase */
export async function getAllPlayersFromFirebase(): Promise<Player[]> {
  const playersRef = ref(db, 'players');
  const snapshot = await get(playersRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  const players: Player[] = [];
  for (const id in data) {
    players.push({ id, ...data[id] });
  }
  return players;
}

/** Subscribe to all players changes */
export function subscribeToPlayers(callback: (snapshot: any) => void): () => void {
  const playersRef = ref(db, 'players');
  onValue(playersRef, callback);
  return () => off(playersRef, 'value', callback);
}

export { ref, set, get, onValue, off };