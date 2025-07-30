import { create } from 'zustand';

export type PluginSettings = {
  tanstackQuery: {
    throttleMs: number;
  };
  // Example of how easy it is to add new plugin settings:
  // networkActivity: {
  //   enabled: boolean;
  //   maxRequests: number;
  //   autoRefresh: boolean;
  // };
  // mmkv: {
  //   enabled: boolean;
  //   maxEntries: number;
  //   showTimestamps: boolean;
  // };
};

export type SettingsStore = {
  settings: PluginSettings;
  updateSettings: <K extends keyof PluginSettings>(
    plugin: K,
    settings: Partial<PluginSettings[K]>
  ) => void;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: {
    tanstackQuery: {
      throttleMs: 0,
    },
  },
  updateSettings: (plugin, settings) =>
    set((state) => ({
      settings: {
        ...state.settings,
        [plugin]: { ...state.settings[plugin], ...settings },
      },
    })),
}));
