import { create } from 'zustand';

export type Transport = 'fetch' | 'expo' | 'nitro';

type NetworkTestState = {
  transport: Transport;
  setTransport: (transport: Transport) => void;
  /**
   * Whether NetworkTestScreen is on screen. The Network Playground controls
   * section is registered only while it is, which is what the section is
   * there to demonstrate: sections registered by a screen appear and
   * disappear with it, alongside the app-level ones that never do.
   */
  isScreenMounted: boolean;
  setScreenMounted: (isScreenMounted: boolean) => void;
};

// Holds NetworkTestScreen's active-transport selection so it can be read and
// reset from rozenite.dev's Network Playground controls section as well as
// from the screen itself.
export const useNetworkTestStore = create<NetworkTestState>((set) => ({
  transport: 'fetch',
  setTransport: (transport) => set({ transport }),
  isScreenMounted: false,
  setScreenMounted: (isScreenMounted) => set({ isScreenMounted }),
}));
