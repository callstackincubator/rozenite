import { create } from 'zustand';

export type Transport = 'fetch' | 'expo' | 'nitro';

type NetworkTestState = {
  transport: Transport;
  setTransport: (transport: Transport) => void;
};

// Holds NetworkTestScreen's active-transport selection so it can be read and
// reset from rozenite.dev's Network Playground controls section as well as
// from the screen itself.
export const useNetworkTestStore = create<NetworkTestState>((set) => ({
  transport: 'fetch',
  setTransport: (transport) => set({ transport }),
}));
