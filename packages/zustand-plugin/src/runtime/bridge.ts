import {
  createRozeniteRpc,
  getRozeniteDevToolsClient,
  type RozeniteDevToolsClient,
} from '@rozenite/plugin-bridge';
import { encodeValue } from '../shared/codec';
import {
  ZUSTAND_PLUGIN_ID,
  type ZustandEventMap,
  type ZustandMethods,
  type ZustandStoreEvent,
} from '../shared/protocol';
import {
  dropIdleListener,
  editStoreValue,
  getLazyValue,
  getRawTrace,
  getSessionId,
  getStoreAdapter,
  hello,
  invokeStoreAction,
  isPanelListening,
  jumpTo,
  notePanelActivity,
  setEventListener,
  setRecording,
} from './store-registry';

type Handlers = {
  [K in keyof ZustandMethods]: (
    ...params: Parameters<ZustandMethods[K]>
  ) => ReturnType<ZustandMethods[K]>;
};

export const createZustandHandlers = (sendEvent: (event: ZustandStoreEvent) => void): Handlers => ({
  hello: async () => {
    setEventListener(sendEvent);
    return hello();
  },
  ping: async () => ({ sessionId: getSessionId(), listening: isPanelListening() }),
  jump: async ({ storeId, seq }) => jumpTo(storeId, seq),
  editPath: async ({ storeId, path, value, op }) => editStoreValue(storeId, path, value, op),
  invokeAction: async ({ storeId, actionPath, args }) => ({
    result: encodeValue(await invokeStoreAction(storeId, actionPath, args)),
  }),
  getLazyValue: async ({ storeId, seq, path }) => getLazyValue(storeId, seq, path),
  getTrace: async ({ traceId }) => getRawTrace(traceId),
  setRecording: async ({ storeId, recording }) => setRecording(storeId, recording),
  persistCommand: async ({ storeId, command }) => {
    const adapter = getStoreAdapter(storeId);
    await adapter.persistCommand(command);
    return { persist: adapter.getPersistInfo() };
  },
});

/**
 * Serves the device side of the protocol on `client`. Any call shows the
 * panel is still there (see `dropIdleListener`).
 */
export const serveZustandRpc = (client: RozeniteDevToolsClient<ZustandEventMap>) => {
  const rpc = createRozeniteRpc<ZustandMethods>(client);
  const handlers = createZustandHandlers((event) => client.send('zustand-event', event));
  const serve = <K extends keyof ZustandMethods>(method: K) =>
    rpc.handle(method, (params) => {
      notePanelActivity();
      return handlers[method](...([params] as Parameters<ZustandMethods[K]>));
    });
  (Object.keys(handlers) as (keyof ZustandMethods)[]).forEach(serve);
  return rpc;
};

/** Settles once connected; `null` before the first try and after a failed one. */
let connection: Promise<void> | null = null;

/** Lazily connects to DevTools the first time a store registers. */
export const ensureBridge = () => {
  connection ??= getRozeniteDevToolsClient<ZustandEventMap>(ZUSTAND_PLUGIN_ID)
    .then((client) => {
      serveZustandRpc(client);
      // Tells an already-open panel to say hello now instead of waiting for
      // its next ping to notice the reload.
      client.send('zustand-event', { type: 'device-ready', sessionId: getSessionId() });
      setInterval(() => dropIdleListener(), 5_000);
    })
    .catch((error: unknown) => {
      console.warn('[Rozenite, zustand-plugin] Failed to connect to DevTools.', error);
      connection = null;
    });
};
