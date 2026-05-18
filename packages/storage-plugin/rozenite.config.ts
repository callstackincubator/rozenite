const EXAMPLE_TARGET = {
  adapterId: 'mmkv',
  storageId: 'user',
} as const;

const EXAMPLE_SESSION_TARGET = {
  adapterId: 'mmkv',
  storageId: 'session',
} as const;

const ROUND_TRIP_TIMEOUT_MS = 5000;

type FlowMessage = {
  payload: unknown;
};

type FlowMatcher =
  | string
  | {
      type?: string;
      direction?: 'in' | 'out';
      predicate?: (message: FlowMessage) => boolean;
    };

type FlowSubscription = {
  remove: () => void;
};

type FlowContext = {
  send: (type: string, payload: unknown) => void;
  onMessage: (matcher: FlowMatcher, listener: (message: FlowMessage) => void) => FlowSubscription;
  waitForMessage: (
    matcher: FlowMatcher,
    options?: { timeoutMs?: number },
  ) => Promise<{ payload: unknown }>;
};

type StorageTargetPayload = {
  target?: { adapterId?: string; storageId?: string };
};

type StorageEntryPayload = StorageTargetPayload & {
  entry?: { key?: string; value?: unknown };
};

type StorageSnapshotPayload = StorageTargetPayload & {
  adapterName?: string;
  storageName?: string;
  capabilities?: { supportedTypes?: string[] };
  entries?: Array<{ key?: string; type?: string; value?: unknown }>;
};

type StorageImportResultPayload = StorageTargetPayload & {
  ok?: boolean;
  written?: number;
  total?: number;
  failedKey?: string;
  error?: string;
};

const matchesExampleTarget = (payload: unknown) => {
  const candidate = payload as StorageTargetPayload;

  return (
    candidate.target?.adapterId === EXAMPLE_TARGET.adapterId &&
    candidate.target?.storageId === EXAMPLE_TARGET.storageId
  );
};

const matchesExampleEntry = (payload: unknown, key: string) => {
  const candidate = payload as StorageEntryPayload;

  return matchesExampleTarget(payload) && candidate.entry?.key === key;
};

const INITIAL_SNAPSHOTS: StorageSnapshotPayload[] = [
  {
    target: EXAMPLE_TARGET,
    adapterName: 'MMKV',
    storageName: 'User',
    capabilities: {
      supportedTypes: ['string'],
    },
    entries: [
      {
        key: 'theme',
        type: 'string',
        value: 'midnight',
      },
      {
        key: 'language',
        type: 'string',
        value: 'en',
      },
    ],
  },
  {
    target: EXAMPLE_SESSION_TARGET,
    adapterName: 'MMKV',
    storageName: 'Session',
    capabilities: {
      supportedTypes: ['string'],
    },
    entries: [
      {
        key: 'authState',
        type: 'string',
        value: 'signed-in',
      },
      {
        key: 'lastSyncStatus',
        type: 'string',
        value: 'success',
      },
    ],
  },
];

export default {
  panels: [
    {
      name: 'Storage',
      source: './src/ui/panel.tsx',
    },
  ],
  dev: {
    flows: [
      {
        name: 'Initialize',
        autoRun: true,
        async run({ send }: FlowContext) {
          for (const snapshot of INITIAL_SNAPSHOTS) {
            send('snapshot', {
              type: 'snapshot',
              target: snapshot.target,
              adapterName: snapshot.adapterName,
              storageName: snapshot.storageName,
              capabilities: snapshot.capabilities,
              entries: snapshot.entries ?? [],
            });
          }

          return {
            storagesSeeded: INITIAL_SNAPSHOTS.map((snapshot) => ({
              target: snapshot.target ?? null,
              adapterName: snapshot.adapterName ?? null,
              storageName: snapshot.storageName ?? null,
              entryCount: snapshot.entries?.length ?? 0,
              supportedTypes: snapshot.capabilities?.supportedTypes ?? [],
            })),
            note:
              'This flow fakes startup by pushing example snapshot events into the UI, mirroring the storage plugin behavior where React Native eagerly emits snapshots on mount.',
          };
        },
      },
      {
        name: 'Set entry and verify live echo',
        async run({ send, waitForMessage }: FlowContext) {
          const entry = {
            key: 'theme',
            type: 'string' as const,
            value: 'midnight',
          };

          send('set-entry', {
            type: 'set-entry',
            target: EXAMPLE_TARGET,
            entry,
          });

          const echoedUpdate = await waitForMessage(
            {
              type: 'set-entry',
              direction: 'out',
              predicate: (message) => matchesExampleEntry(message.payload, entry.key),
            },
            { timeoutMs: ROUND_TRIP_TIMEOUT_MS },
          );

          send('get-snapshot', {
            type: 'get-snapshot',
            target: EXAMPLE_TARGET,
          });

          const snapshot = await waitForMessage(
            {
              type: 'snapshot',
              direction: 'out',
              predicate: (message) => {
                const payload = message.payload as StorageSnapshotPayload;

                return (
                  matchesExampleTarget(payload) &&
                  (payload.entries ?? []).some((candidate) => candidate.key === entry.key)
                );
              },
            },
            { timeoutMs: ROUND_TRIP_TIMEOUT_MS },
          );

          const echoedPayload = echoedUpdate.payload as StorageEntryPayload;
          const snapshotPayload = snapshot.payload as StorageSnapshotPayload;
          const storedEntry = (snapshotPayload.entries ?? []).find(
            (candidate) => candidate.key === entry.key,
          );

          return {
            echoedValue: echoedPayload.entry?.value,
            snapshotValue: storedEntry?.value,
            entryCount: snapshotPayload.entries?.length ?? 0,
          };
        },
      },
      {
        name: 'Import entries and track completion',
        async run({ send, onMessage, waitForMessage }: FlowContext) {
          const echoedKeys: string[] = [];

          const subscription = onMessage(
            {
              type: 'set-entry',
              direction: 'out',
              predicate: (message) => matchesExampleTarget(message.payload),
            },
            (message) => {
              const payload = message.payload as StorageEntryPayload;

              if (payload.entry?.key) {
                echoedKeys.push(payload.entry.key);
              }
            },
          );

          try {
            send('import-entries', {
              type: 'import-entries',
              target: EXAMPLE_TARGET,
              entries: [
                {
                  key: 'theme',
                  type: 'string',
                  value: 'dark',
                },
                {
                  key: 'launchCount',
                  type: 'number',
                  value: 3,
                },
                {
                  key: 'hasSeenOnboarding',
                  type: 'boolean',
                  value: true,
                },
              ],
            });

            const importResult = await waitForMessage(
              {
                type: 'import-result',
                direction: 'out',
                predicate: (message) => matchesExampleTarget(message.payload),
              },
              { timeoutMs: ROUND_TRIP_TIMEOUT_MS },
            );

            send('get-snapshot', {
              type: 'get-snapshot',
              target: EXAMPLE_TARGET,
            });

            const snapshot = await waitForMessage(
              {
                type: 'snapshot',
                direction: 'out',
                predicate: (message) => matchesExampleTarget(message.payload),
              },
              { timeoutMs: ROUND_TRIP_TIMEOUT_MS },
            );

            const resultPayload = importResult.payload as StorageImportResultPayload;
            const snapshotPayload = snapshot.payload as StorageSnapshotPayload;

            return {
              ok: resultPayload.ok ?? false,
              echoedKeys,
              written: resultPayload.written ?? 0,
              total: resultPayload.total ?? 0,
              failedKey: resultPayload.failedKey ?? null,
              error: resultPayload.error ?? null,
              snapshotKeys: (snapshotPayload.entries ?? []).map((entry) => entry.key),
            };
          } finally {
            subscription.remove();
          }
        },
      },
    ],
    templates: [
      {
        name: 'Initial sync: request all snapshots',
        type: 'get-snapshot',
        payload: {
          type: 'get-snapshot',
          target: 'all',
        },
      },
      {
        name: 'Refresh one storage snapshot',
        type: 'get-snapshot',
        payload: {
          type: 'get-snapshot',
          target: EXAMPLE_TARGET,
        },
      },
      {
        name: 'Round-trip: set string entry',
        type: 'set-entry',
        payload: {
          type: 'set-entry',
          target: EXAMPLE_TARGET,
          entry: {
            key: 'theme',
            type: 'string',
            value: 'midnight',
          },
        },
      },
      {
        name: 'Round-trip: set boolean entry',
        type: 'set-entry',
        payload: {
          type: 'set-entry',
          target: EXAMPLE_TARGET,
          entry: {
            key: 'hasSeenOnboarding',
            type: 'boolean',
            value: true,
          },
        },
      },
      {
        name: 'Round-trip: delete entry',
        type: 'delete-entry',
        payload: {
          type: 'delete-entry',
          target: EXAMPLE_TARGET,
          key: 'theme',
        },
      },
      {
        name: 'Bulk import: stream writes and result',
        type: 'import-entries',
        payload: {
          type: 'import-entries',
          target: EXAMPLE_TARGET,
          entries: [
            {
              key: 'theme',
              type: 'string',
              value: 'dark',
            },
            {
              key: 'launchCount',
              type: 'number',
              value: 3,
            },
          ],
        },
      },
    ],
  },
};
