import { create } from 'zustand';
import type { createRozeniteRpc } from '@rozenite/plugin-bridge';
import type {
  HelloResult,
  StoreWarning,
  ZustandMethods,
  ZustandStoreEvent,
} from '../../shared/protocol';
import {
  applyHello,
  applyTransitions,
  createModel,
  updateDescriptor,
  upsertStore,
  type HistoryModel,
} from '../history/model';

export type ZustandRpc = ReturnType<typeof createRozeniteRpc<ZustandMethods>>;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export type DetailTab = 'diff' | 'state' | 'action' | 'trace';
export type HomeTab = 'state' | 'actions' | 'persist';

/** A selected timeline row: store + seq. */
export type Selection = { storeId: string; seq: number };

export type PanelState = {
  model: HistoryModel;
  rpc: ZustandRpc | null;
  status: ConnectionStatus;
  warnings: readonly StoreWarning[];
  dismissedWarnings: ReadonlySet<string>;
  /** null = "All stores". */
  selectedStoreId: string | null;
  selection: Selection | null;
  detailTab: DetailTab;
  homeTab: HomeTab;
  filter: string;
};

export const warningKey = (warning: StoreWarning) =>
  `${warning.storeId ?? ''}|${warning.code}|${warning.message}`;

export const usePanelStore = create<PanelState>(() => ({
  model: createModel(),
  rpc: null,
  status: 'connecting',
  warnings: [],
  dismissedWarnings: new Set(),
  selectedStoreId: null,
  selection: null,
  detailTab: 'diff',
  homeTab: 'state',
  filter: '',
}));

const set = usePanelStore.setState;
const get = usePanelStore.getState;

export const panelActions = {
  setRpc: (rpc: ZustandRpc | null) => {
    // The hook starts out without a client, which is still "connecting".
    const lost = !rpc && get().status !== 'connecting';
    set({ rpc, status: lost ? 'disconnected' : 'connecting' });
  },
  setStatus: (status: ConnectionStatus) => set({ status }),

  applyHello: (hello: HelloResult) => {
    const previousSession = get().model.sessionId;
    const model = applyHello(get().model, hello);
    const known = new Set(get().warnings.map(warningKey));
    const sameSession = previousSession === hello.sessionId;
    const warnings = sameSession
      ? [...get().warnings, ...hello.warnings.filter((warning) => !known.has(warningKey(warning)))]
      : hello.warnings;
    const sessionChanged = previousSession !== null && !sameSession;
    set({
      model,
      warnings,
      status: 'connected',
      // Seqs restart with the app: a selected row would point at another one.
      ...(sessionChanged ? { selection: null } : {}),
    });
    // Keep a selected store that still exists; otherwise fall back to "All".
    const selected = get().selectedStoreId;
    if (selected && !model.stores.has(selected)) set({ selectedStoreId: null });
    return { sessionChanged };
  },

  applyEvent: (event: ZustandStoreEvent) => {
    const state = get();
    switch (event.type) {
      case 'store-upsert':
        set({ model: upsertStore(state.model, event.store, event.keyframe) });
        return;
      case 'store-update':
        set({ model: updateDescriptor(state.model, event.store) });
        return;
      case 'transitions':
        set({ model: applyTransitions(state.model, event.transitions, event.keyframes) });
        return;
      case 'warning': {
        const key = warningKey(event.warning);
        if (state.warnings.some((warning) => warningKey(warning) === key)) return;
        set({ warnings: [...state.warnings, event.warning].slice(-100) });
        return;
      }
      default:
        return;
    }
  },

  dismissWarning: (warning: StoreWarning) =>
    set({ dismissedWarnings: new Set([...get().dismissedWarnings, warningKey(warning)]) }),

  selectStore: (storeId: string | null) => set({ selectedStoreId: storeId, selection: null }),
  select: (selection: Selection | null) => set({ selection }),
  setDetailTab: (detailTab: DetailTab) => set({ detailTab }),
  setHomeTab: (homeTab: HomeTab) => set({ homeTab }),
  setFilter: (filter: string) => set({ filter }),
};

/**
 * Whether the selected store (or every store, for "All stores") records.
 * False when there is no store to record.
 */
export const isRecording = (state: PanelState) => {
  const selected = state.selectedStoreId
    ? state.model.stores.get(state.selectedStoreId)
    : undefined;
  const targets = selected ? [selected] : [...state.model.stores.values()];
  return targets.length > 0 && targets.every((store) => store.descriptor.recording);
};

export const requireRpc = (): ZustandRpc => {
  const rpc = get().rpc;
  if (!rpc) {
    throw new Error('The Zustand plugin is not connected to the app.');
  }
  return rpc;
};
