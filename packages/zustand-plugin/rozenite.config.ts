/**
 * Dev-host fixtures (`pnpm run dev`, localhost:8888): a simulated device that
 * answers the panel's RPC calls and streams state events, so the panel can be
 * developed without an app. Self-contained on purpose -- the config is loaded
 * on its own, not as part of the plugin build.
 */

type DevFlowMessage = { type: string; payload: unknown; direction: 'in' | 'out' };

type DevFlowContext = {
  signal: AbortSignal;
  send: (type: string, payload: unknown) => void;
  onMessage: (
    matcher: { type?: string; direction?: 'in' | 'out' },
    listener: (message: DevFlowMessage) => void,
  ) => { remove: () => void };
};

type RequestFrame = {
  kind: 'request';
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

const RPC = 'rozenite:rpc';
const SESSION = 'dev-host-session';
const t0 = Date.now() - 60_000;

const store = (storeId: string, extra: Record<string, unknown> = {}) => ({
  storeId,
  name: storeId,
  actions: [],
  generation: 1,
  createdAt: t0,
  recording: true,
  maxAge: 50,
  ...extra,
});

const cartActions = [
  { path: 'addItem', name: 'addItem', arity: 1 },
  { path: 'removeItem', name: 'removeItem', arity: 1 },
  { path: 'checkout', name: 'checkout', arity: 0 },
];

const fn = (name: string, arity: number) => ({ $t: 'fn', name, arity });

const cartBase = {
  items: [],
  total: 0,
  coupon: null,
  updatedAt: { $t: 'date', v: new Date(t0).toISOString() },
  tags: { $t: 'set', v: [] },
  addItem: fn('addItem', 1),
  removeItem: fn('removeItem', 1),
  checkout: fn('checkout', 0),
};

const item = (id: number, qty = 1) => ({ id, name: `Item ${id}`, qty, price: id * 10 });

let seq = 0;
const tr = (
  storeId: string,
  action: { name: string; source: string; args?: unknown[] },
  patches: unknown[],
) => {
  seq += 1;
  return {
    storeId,
    seq,
    timestamp: t0 + seq * 900,
    action,
    patches,
    durationMs: 0.4 + (seq % 5) * 0.7,
    traceId: `trace-${seq}`,
  };
};

const cartTransitions = [
  tr('Cart', { name: 'persist/rehydrate', source: 'hydrate' }, [
    { op: 'replace', path: ['coupon'], old: null, value: 'WELCOME' },
  ]),
  tr('Cart', { name: 'addItem', source: 'action', args: [item(1)] }, [
    { op: 'add', path: ['items', 0], value: item(1) },
    { op: 'replace', path: ['total'], old: 0, value: 10 },
  ]),
  tr('Cart', { name: 'checkout', source: 'async', args: [] }, [
    { op: 'replace', path: ['items'], old: [item(1)], value: [] },
    { op: 'replace', path: ['total'], old: 10, value: 0 },
  ]),
  tr('Cart', { name: 'cart/applyCoupon', source: 'named' }, [
    { op: 'replace', path: ['coupon'], old: 'WELCOME', value: 'SPRING' },
  ]),
  tr('Cart', { name: 'setState', source: 'external' }, [
    { op: 'replace', path: ['tags'], old: { $t: 'set', v: [] }, value: { $t: 'set', v: ['vip'] } },
  ]),
];

const authBase = {
  user: null,
  token: null,
  login: fn('login', 2),
  logout: fn('logout', 0),
  sessions: {
    $t: 'map',
    v: [
      ['web', { lastSeen: 1 }],
      ['ios', { lastSeen: 2 }],
    ],
  },
};

const hello = () => ({
  sessionId: SESSION,
  stores: [
    store('Cart', {
      actions: cartActions,
      persist: { storageKey: 'cart-storage', version: 2, hasHydrated: true },
      jumpedTo: 3,
    }),
    store('Auth', {
      actions: [
        { path: 'login', name: 'login', arity: 2 },
        { path: 'logout', name: 'logout', arity: 0 },
      ],
    }),
  ],
  keyframes: [
    { storeId: 'Cart', seq: 0, state: cartBase },
    { storeId: 'Auth', seq: 0, state: authBase },
  ],
  transitions: cartTransitions,
  warnings: [
    {
      storeId: 'Auth',
      code: 'not-outermost',
      message:
        'rozenite() is not the outermost middleware of "Auth", so persist hydration is invisible to it.',
      fix: "create(rozenite(persist(…), { name: 'Auth' }))",
    },
  ],
});

const rawStack = [
  'Error',
  '    at addItem (http://localhost:8081/index.bundle?platform=ios:2401:9)',
  '    at onPress (http://localhost:8081/index.bundle?platform=ios:8812:15)',
].join('\n');

const respond = (method: string, params: Record<string, unknown> = {}): unknown => {
  switch (method) {
    case 'hello':
      return hello();
    case 'ping':
      return { sessionId: SESSION, listening: true };
    case 'getTrace':
      return rawStack;
    case 'invokeAction':
      return { result: { ok: true, echoed: params.args } };
    case 'persistCommand':
      return { persist: { storageKey: 'cart-storage', version: 2, hasHydrated: true } };
    default:
      return undefined;
  }
};

export default {
  integrations: ['react-native'],
  panels: [
    {
      name: 'Zustand',
      source: './src/ui/panel.tsx',
    },
  ],
  dev: {
    flows: [
      {
        name: 'Simulated device',
        autoRun: true,
        run: async ({ send, onMessage, signal }: DevFlowContext) => {
          let tick = 0;
          let liveSeq = 100;

          onMessage({ type: RPC, direction: 'out' }, (message) => {
            const frame = message.payload as RequestFrame;
            if (frame?.kind !== 'request') return;
            send(RPC, { kind: 'ack', id: frame.id });
            send(RPC, { kind: 'result', id: frame.id, value: respond(frame.method, frame.params) });
          });

          // A live "Clock" store so the timeline and sidebar flash keep moving.
          const timer = setInterval(() => {
            tick += 1;
            liveSeq += 1;
            if (tick === 1) {
              send('zustand-event', {
                type: 'store-upsert',
                store: store('Clock', { actions: [{ path: 'tick', name: 'tick', arity: 0 }] }),
                keyframe: { storeId: 'Clock', seq: 100, state: { ticks: 0, tick: fn('tick', 0) } },
              });
              return;
            }
            send('zustand-event', {
              type: 'transitions',
              transitions: [
                {
                  storeId: 'Clock',
                  seq: liveSeq,
                  timestamp: Date.now(),
                  action: { name: 'tick', source: 'action', args: [] },
                  patches: [{ op: 'replace', path: ['ticks'], old: tick - 2, value: tick - 1 }],
                  durationMs: 0.3,
                },
              ],
              keyframes: [],
            });
          }, 3_000);

          await new Promise<void>((resolve) => {
            signal.addEventListener('abort', () => {
              clearInterval(timer);
              resolve();
            });
          });
          return { message: 'Simulated device stopped.' };
        },
      },
    ],
  },
};
