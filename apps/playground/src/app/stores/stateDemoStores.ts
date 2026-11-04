import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { rozenite } from '@rozenite/zustand-plugin';

// Demo stores for the Zustand plugin screen:
// - Cart:    rozenite() + persist -- named actions, args, async attribution,
//            a Map in state, hydration, and time travel written to storage.
// - Session: rozenite() -- concurrent async actions (left anonymous rather
//            than guessed) and a cross-store action (logout clears the cart).

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type CartLine = { name: string; qty: number };

type CartState = {
  lines: Map<string, CartLine>;
  status: 'idle' | 'checking-out' | 'paid';
  updatedAt: Date | null;
  addItem: (sku: string, name: string) => void;
  setQty: (sku: string, qty: number) => void;
  removeItem: (sku: string) => void;
  checkout: () => Promise<void>;
  clear: () => void;
};

export const useCartStore = create<CartState>()(
  rozenite(
    persist(
      (set, get) => ({
        lines: new Map(),
        status: 'idle',
        updatedAt: null,
        addItem: (sku, name) =>
          set((state) => {
            const lines = new Map(state.lines);
            const line = lines.get(sku);
            lines.set(sku, { name, qty: (line?.qty ?? 0) + 1 });
            return { lines, updatedAt: new Date() };
          }),
        setQty: (sku, qty) =>
          set((state) => {
            const line = state.lines.get(sku);
            if (!line) return state;
            return {
              lines: new Map(state.lines).set(sku, { ...line, qty }),
              updatedAt: new Date(),
            };
          }),
        removeItem: (sku) =>
          set((state) => {
            const lines = new Map(state.lines);
            lines.delete(sku);
            return { lines, updatedAt: new Date() };
          }),
        checkout: async () => {
          if (get().lines.size === 0) return;
          set({ status: 'checking-out' });
          await wait(800);
          set({ status: 'paid', lines: new Map(), updatedAt: new Date() });
        },
        clear: () => set({ lines: new Map(), status: 'idle', updatedAt: new Date() }),
      }),
      {
        name: 'zustand-plugin-demo-cart',
        storage: createJSONStorage(() => AsyncStorage, {
          replacer: (_key, value) =>
            value instanceof Map ? { __map: [...value.entries()] } : value,
          reviver: (_key, value) =>
            value && typeof value === 'object' && '__map' in value
              ? new Map((value as { __map: [string, CartLine][] }).__map)
              : value,
        }),
        partialize: (state) => ({ lines: state.lines }),
      },
    ),
    { name: 'Cart', trace: true },
  ),
);

type SessionState = {
  user: { id: number; name: string } | null;
  profileVersion: number;
  loading: boolean;
  login: (name: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => void;
};

export const useSessionStore = create<SessionState>()(
  rozenite(
    (set, get) => ({
      user: null,
      profileVersion: 0,
      loading: false,
      login: async (name) => {
        set({ loading: true });
        await wait(600);
        set({ user: { id: Math.floor(Math.random() * 1000), name }, loading: false });
      },
      refreshProfile: async () => {
        await wait(400);
        set({ profileVersion: get().profileVersion + 1 });
      },
      logout: () => {
        set({ user: null }, false, 'session/logout');
        // Shows up in the Cart timeline as "Session.logout".
        useCartStore.getState().clear();
      },
    }),
    { name: 'Session' },
  ),
);
