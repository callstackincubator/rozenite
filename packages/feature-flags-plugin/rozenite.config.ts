import type { FeatureFlag, FeatureFlagValue } from './src/shared/types';

// Kept inline rather than imported, like `packages/storage-plugin`'s dev
// fixtures: this file is loaded by transforming its source with esbuild and
// running it through `new Function(module, exports, code)` (see
// `packages/vite-plugin/src/load-config.ts`), with no `require` in scope.
// Only type-only imports survive that (they're erased before evaluation).
type DevFlowMessage = {
  id: string;
  direction: 'in' | 'out';
  date: string;
  type: string;
  payload: unknown;
};

type DevFlowMessageMatcher =
  | string
  | ((message: DevFlowMessage) => boolean)
  | {
      type?: string;
      direction?: DevFlowMessage['direction'];
      predicate?: (message: DevFlowMessage) => boolean;
    };

type DevFlowContext = {
  signal: AbortSignal;
  send: (type: string, payload: unknown) => void;
  onMessage: (
    matcher: DevFlowMessageMatcher,
    listener: (message: DevFlowMessage) => void,
  ) => { remove: () => void };
  waitForMessage: (
    matcher: DevFlowMessageMatcher,
    options?: { timeoutMs?: number },
  ) => Promise<DevFlowMessage>;
  getMessages: (matcher?: DevFlowMessageMatcher) => DevFlowMessage[];
};

// RPC rides on a single reserved message type. A request frame from the
// panel looks like `{ kind: 'request', id, method, params, heartbeatMs }`;
// we ack it immediately, then reply with a `result` or `error` frame -- see
// `packages/plugin-bridge/src/rpc/create-rozenite-rpc.ts`.
const ROZENITE_RPC_MESSAGE_TYPE = 'rozenite:rpc';

type RequestFrame = {
  kind: 'request';
  id: string;
  method: string;
  params: unknown;
};

type FixtureFlag = FeatureFlag;

type FixtureProvider = {
  id: string;
  name: string;
  flags: Map<string, FixtureFlag>;
  defaults: Map<string, FeatureFlagValue>;
};

const createFixtureProvider = (id: string, name: string, flags: FeatureFlag[]): FixtureProvider => {
  const flagsMap = new Map<string, FixtureFlag>();
  const defaults = new Map<string, FeatureFlagValue>();

  flags.forEach((flag) => {
    flagsMap.set(flag.key, { ...flag });
    defaults.set(flag.key, flag.value);
  });

  return { id, name, flags: flagsMap, defaults };
};

const fixtureProviders: FixtureProvider[] = [
  createFixtureProvider('app', 'App flags', [
    { key: 'dark-mode', type: 'boolean', value: true, overridden: false },
    { key: 'welcome-message', type: 'string', value: 'Welcome to Rozenite!', overridden: false },
    { key: 'max-items-per-page', type: 'number', value: 25, overridden: false },
    {
      key: 'checkout-config',
      type: 'json',
      value: { steps: ['cart', 'shipping', 'payment'], expressCheckout: false },
      overridden: false,
    },
  ]),
  createFixtureProvider('launchdarkly', 'LaunchDarkly', [
    { key: 'new-onboarding', type: 'boolean', value: false, overridden: false },
    { key: 'search-provider', type: 'string', value: 'elastic', overridden: true },
  ]),
];

const findFixtureProvider = (providerId?: string): FixtureProvider => {
  if (providerId != null) {
    const provider = fixtureProviders.find((candidate) => candidate.id === providerId);
    if (!provider) {
      throw new Error(`Unknown provider "${providerId}".`);
    }
    return provider;
  }

  if (fixtureProviders.length !== 1) {
    throw new Error('providerId is required when more than one provider is registered.');
  }

  return fixtureProviders[0];
};

const snapshotFlags = (provider: FixtureProvider): FeatureFlag[] =>
  Array.from(provider.flags.values()).map((flag) => ({ ...flag }));

const handleFeatureFlagsMethod = (method: string, params: any): unknown => {
  switch (method) {
    case 'getSnapshot':
      return {
        providers: fixtureProviders.map((provider) => ({
          id: provider.id,
          name: provider.name,
          flags: snapshotFlags(provider),
        })),
      };

    case 'setOverride': {
      const provider = findFixtureProvider(params?.providerId);
      const existing = provider.flags.get(params.key);
      if (!existing) {
        throw new Error(`Unknown flag "${params.key}".`);
      }
      const updated: FixtureFlag = { ...existing, value: params.value, overridden: true };
      provider.flags.set(params.key, updated);
      return { flag: { ...updated } };
    }

    case 'clearOverride': {
      const provider = findFixtureProvider(params?.providerId);
      const existing = provider.flags.get(params.key);
      if (!existing) {
        throw new Error(`Unknown flag "${params.key}".`);
      }
      const defaultValue = provider.defaults.get(params.key) ?? existing.value;
      const updated: FixtureFlag = { ...existing, value: defaultValue, overridden: false };
      provider.flags.set(params.key, updated);
      return { flag: { ...updated } };
    }

    case 'clearAllOverrides': {
      const provider = findFixtureProvider(params?.providerId);
      let cleared = 0;
      provider.flags.forEach((flag, key) => {
        if (!flag.overridden) return;
        cleared += 1;
        provider.flags.set(key, {
          ...flag,
          value: provider.defaults.get(key) ?? flag.value,
          overridden: false,
        });
      });
      return { cleared };
    }

    case 'refresh':
      findFixtureProvider(params?.providerId);
      return undefined;

    default:
      throw new Error(`Unhandled Feature Flags RPC method "${method}".`);
  }
};

export default {
  integrations: ['react-native', 'react-native-web', 'lynx', 'lynx-web'],
  panels: [
    {
      name: 'Feature Flags',
      source: './src/ui/panel.tsx',
    },
  ],
  dev: {
    flows: [
      {
        name: 'Respond to Feature Flags RPC calls',
        autoRun: true,
        run: async ({ send, onMessage, signal }: DevFlowContext) => {
          onMessage(
            {
              type: ROZENITE_RPC_MESSAGE_TYPE,
              direction: 'out',
              predicate: (message) =>
                (message.payload as { kind?: string } | null)?.kind === 'request',
            },
            (message) => {
              const frame = message.payload as RequestFrame;

              send(ROZENITE_RPC_MESSAGE_TYPE, { kind: 'ack', id: frame.id });

              try {
                const value = handleFeatureFlagsMethod(frame.method, frame.params);
                send(ROZENITE_RPC_MESSAGE_TYPE, { kind: 'result', id: frame.id, value });
              } catch (error) {
                send(ROZENITE_RPC_MESSAGE_TYPE, {
                  kind: 'error',
                  id: frame.id,
                  source: 'handler',
                  name: 'Error',
                  message: error instanceof Error ? error.message : String(error),
                });
              }
            },
          );

          return await new Promise((resolve) => {
            signal.addEventListener(
              'abort',
              () => resolve({ message: 'Feature flags fixture responder stopped.' }),
              { once: true },
            );
          });
        },
      },
    ],
  },
};
