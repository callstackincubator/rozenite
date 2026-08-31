type DevFlowContext = {
  send: (type: string, payload: unknown) => void;
  waitForMessage: (
    matcher: { type?: string; direction?: 'in' | 'out' },
    options?: { timeoutMs?: number },
  ) => Promise<{ payload: unknown }>;
};

const storageFixtures = [
  {
    type: 'snapshot',
    target: { adapterId: 'async-storage', storageId: 'default' },
    adapterName: 'AsyncStorage',
    storageName: 'Default Storage',
    capabilities: { supportedTypes: ['string'] },
    entries: [
      {
        key: 'welcome-message',
        type: 'string',
        value: 'Hello from AsyncStorage',
      },
    ],
  },
  {
    type: 'snapshot',
    target: { adapterId: 'expo-secure-store', storageId: 'default' },
    adapterName: 'Expo SecureStore',
    storageName: 'Default Secure Storage',
    capabilities: { supportedTypes: ['string'] },
    entries: [
      {
        key: 'access-token',
        type: 'string',
        value: 'secure-token-fixture',
      },
    ],
  },
  {
    type: 'snapshot',
    target: { adapterId: 'mmkv', storageId: 'default' },
    adapterName: 'MMKV',
    storageName: 'default',
    capabilities: { supportedTypes: ['string', 'number', 'boolean', 'buffer'] },
    entries: [
      { key: 'display-name', type: 'string', value: 'Rozenite' },
      { key: 'launch-count', type: 'number', value: 42 },
      { key: 'onboarding-complete', type: 'boolean', value: true },
      { key: 'binary-token', type: 'buffer', value: [82, 78, 68, 101, 118] },
    ],
  },
];

export default {
  integrations: ['react-native'],
  panels: [
    {
      name: 'Storage',
      source: './src/ui/panel.tsx',
    },
  ],
  dev: {
    flows: [
      {
        name: 'Initialize storage fixtures',
        autoRun: true,
        run: async ({ send, waitForMessage }: DevFlowContext) => {
          await waitForMessage({ type: 'get-snapshot', direction: 'out' }, { timeoutMs: 10000 });

          storageFixtures.forEach((snapshot) => send('snapshot', snapshot));

          return {
            message: 'Initialized AsyncStorage, Expo SecureStore, and MMKV fixtures.',
            storages: storageFixtures.length,
            entries: storageFixtures.reduce(
              (total, snapshot) => total + snapshot.entries.length,
              0,
            ),
          };
        },
      },
    ],
  },
};
