import { create } from 'zustand';

type FeatureFlags = {
  verboseLogging: boolean;
  mockLatency: boolean;
  reverseDiagnostics: boolean;
};

type ControlsPluginState = {
  counter: number;
  selectedEnvironment: 'local' | 'staging' | 'production';
  status: 'idle' | 'armed' | 'synced';
  lastActionAt: string | null;
  notes: string[];
  featureFlags: FeatureFlags;
  selectEnvironment: (
    environment: ControlsPluginState['selectedEnvironment']
  ) => void;
  toggleFlag: (flag: keyof FeatureFlags, nextValue: boolean) => void;
  incrementCounter: () => void;
  markSynced: () => void;
  addCheckpoint: () => void;
  resetDemo: () => void;
};

const formatTimestamp = (date: Date) => date.toLocaleTimeString();

const initialFeatureFlags: FeatureFlags = {
  verboseLogging: true,
  mockLatency: false,
  reverseDiagnostics: false,
};

export const useControlsPluginStore = create<ControlsPluginState>((set) => ({
  counter: 0,
  selectedEnvironment: 'local',
  status: 'idle',
  lastActionAt: null,
  notes: [],
  featureFlags: initialFeatureFlags,
  selectEnvironment: (selectedEnvironment) =>
    set(() => ({
      selectedEnvironment,
      lastActionAt: formatTimestamp(new Date()),
    })),
  toggleFlag: (flag, nextValue) =>
    set((state) => ({
      featureFlags: {
        ...state.featureFlags,
        [flag]: nextValue,
      },
      status: nextValue ? 'armed' : state.status === 'armed' ? 'idle' : state.status,
      lastActionAt: formatTimestamp(new Date()),
    })),
  incrementCounter: () =>
    set((state) => ({
      counter: state.counter + 1,
      status: 'armed',
      lastActionAt: formatTimestamp(new Date()),
    })),
  markSynced: () =>
    set(() => ({
      status: 'synced',
      lastActionAt: formatTimestamp(new Date()),
    })),
  addCheckpoint: () =>
    set((state) => ({
      notes: [
        `Checkpoint ${state.notes.length + 1} at ${formatTimestamp(new Date())}`,
        ...state.notes,
      ].slice(0, 5),
      lastActionAt: formatTimestamp(new Date()),
    })),
  resetDemo: () =>
    set(() => ({
      counter: 0,
      selectedEnvironment: 'local',
      status: 'idle',
      lastActionAt: formatTimestamp(new Date()),
      notes: [],
      featureFlags: initialFeatureFlags,
    })),
}));
