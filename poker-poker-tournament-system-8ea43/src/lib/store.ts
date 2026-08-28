import { create } from 'zustand';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, serverTimestamp, increment, getFirestore } from 'firebase/firestore';
import { db } from '../firebase';

interface Player {
  id: string;
  name: string;
  stack: number;
  seat: number | null;
  tableId: string | null;
  rebuys: number;
  addons: number;
  eliminated: boolean;
  eliminationPlace: number | null;
  eliminatedBy: string | null;
}

interface Tournament {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  registrationEnds: Date;
  rebuyTimeEnds: Date;
  buyIn: number;
  rebuyCost: number;
  addonCost: number;
  startingStack: number;
  status: 'registration' | 'inProgress' | 'completed';
  registeredPlayers: string[];
  players: Record<string, Player>;
  currentLevel: number;
  nextBreakInMinutes: number | null;
  totalPrizePool: number;
  leaderboard: Array<{ playerId: string; playerName: string; place: number; prize: number }>;
}

interface Store {
  tournaments: Tournament[];
  currentUser: { id: string; name: string } | null;
  setCurrentUser: (user: { id: string; name: string }) => void;
  subscribeToTournaments: () => () => void;
  toggleEntry: (tournamentId: string) => Promise<void>;
  assignSeat: (tournamentId: string, playerId: string, tableId: string, seat: number) => Promise<void>;
  eliminate: (tournamentId: string, playerId: string, eliminatedBy: string) => Promise<void>;
  rebuyStack: (tournamentId: string, playerId: string) => Promise<void>;
  addAddon: (tournamentId: string, playerId: string) => Promise<void>;
  setTournamentStatus: (tournamentId: string, status: 'inProgress' | 'completed') => Promise<void>;
}

export const useStore = create<Store>((set, get) => ({
  tournaments: [],
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  
  subscribeToTournaments: () => {
    const unsubscribe = onSnapshot(doc(db, 'global', 'tournaments'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const tournaments = Object.entries(data.tournaments || {}).map(([id, tournamentData]: [string, any]) => ({
          id,
          ...tournamentData,
          startDate: tournamentData.startDate?.toDate ? tournamentData.startDate.toDate() : new Date(tournamentData.startDate),
          registrationEnds: tournamentData.registrationEnds?.toDate ? tournamentData.registrationEnds.toDate() : new Date(tournamentData.registrationEnds),
          rebuyTimeEnds: tournamentData.rebuyTimeEnds?.toDate ? tournamentData.rebuyTimeEnds.toDate() : new Date(tournamentData.rebuyTimeEnds),
        }));
        set({ tournaments });
      }
    });

    return unsubscribe;
  },

  toggleEntry: async (tournamentId) => {
    const { currentUser } = get();
    if (!currentUser) return;

    const tournamentRef = doc(db, 'global', 'tournaments');
    const tournament = get().tournaments.find(t => t.id === tournamentId);
    
    if (tournament) {
      const isRegistered = tournament.registeredPlayers.includes(currentUser.id);
      if (isRegistered) {
        await updateDoc(tournamentRef, {
          [`tournaments.${tournamentId}.registeredPlayers`]: arrayRemove(currentUser.id)
        });
      } else {
        await updateDoc(tournamentRef, {
          [`tournaments.${tournamentId}.registeredPlayers`]: arrayUnion(currentUser.id),
          [`tournaments.${tournamentId}.totalPrizePool`]: increment(tournament.buyIn)
        });
      }
    }
  },

  assignSeat: async (tournamentId, playerId, tableId, seat) => {
    const tournamentRef = doc(db, 'global', 'tournaments');
    await updateDoc(tournamentRef, {
      [`tournaments.${tournamentId}.players.${playerId}`]: {
        id: playerId,
        name: '', // Will be populated by admin
        stack: 0, // Will be set when tournament starts
        seat,
        tableId,
        rebuys: 0,
        addons: 0,
        eliminated: false,
        eliminationPlace: null,
        eliminatedBy: null
      }
    });
  },

  eliminate: async (tournamentId, playerId, eliminatedBy) => {
    const tournamentRef = doc(db, 'global', 'tournaments');
    const tournament = get().tournaments.find(t => t.id === tournamentId);
    
    if (tournament) {
      const playerCount = tournament.registeredPlayers.length;
      const eliminatedPlayersCount = Object.values(tournament.players).filter(p => p.eliminated).length;
      const place = eliminatedPlayersCount + 1;

      await updateDoc(tournamentRef, {
        [`tournaments.${tournamentId}.players.${playerId}.eliminated`]: true,
        [`tournaments.${tournamentId}.players.${playerId}.eliminationPlace`]: place,
        [`tournaments.${tournamentId}.players.${playerId}.eliminatedBy`]: eliminatedBy
      });
    }
  },

  rebuyStack: async (tournamentId, playerId) => {
    const tournamentRef = doc(db, 'global', 'tournaments');
    const tournament = get().tournaments.find(t => t.id === tournamentId);
    
    if (tournament && new Date() < tournament.rebuyTimeEnds) {
      await updateDoc(tournamentRef, {
        [`tournaments.${tournamentId}.players.${playerId}.stack`]: increment(tournament.startingStack),
        [`tournaments.${tournamentId}.players.${playerId}.rebuys`]: increment(1),
        [`tournaments.${tournamentId}.totalPrizePool`]: increment(tournament.rebuyCost)
      });
    }
  },

  addAddon: async (tournamentId, playerId) => {
    const tournamentRef = doc(db, 'global', 'tournaments');
    const tournament = get().tournaments.find(t => t.id === tournamentId);
    
    if (tournament && new Date() < tournament.rebuyTimeEnds) {
      await updateDoc(tournamentRef, {
        [`tournaments.${tournamentId}.players.${playerId}.stack`]: increment(tournament.startingStack),
        [`tournaments.${tournamentId}.players.${playerId}.addons`]: increment(1),
        [`tournaments.${tournamentId}.totalPrizePool`]: increment(tournament.addonCost)
      });
    }
  },

  setTournamentStatus: async (tournamentId, status) => {
    const tournamentRef = doc(db, 'global', 'tournaments');
    await updateDoc(tournamentRef, {
      [`tournaments.${tournamentId}.status`]: status
    });
  }
}));
