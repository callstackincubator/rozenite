import { createTracked } from './helpers';
import { createRozeniteRpc, getRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { connectFakePair } from '@rozenite/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPatches } from '../shared/patch';
import {
  ZUSTAND_PLUGIN_ID,
  type ZustandEventMap,
  type ZustandMethods,
  type ZustandStoreEvent,
} from '../shared/protocol';
import { serveZustandRpc } from '../runtime/bridge';
import { __resetRegistry } from '../runtime/store-registry';

/**
 * The real device handlers against the real panel-side RPC calls over an
 * in-memory `@rozenite/testing` pair: no Metro, no DevTools, nothing in
 * `@rozenite/plugin-bridge` mocked. This is the wire contract the panel and
 * the middleware must agree on.
 */
describe('Zustand plugin protocol over a fake pair', () => {
  const openHandles: { close: () => void }[] = [];

  beforeEach(() => __resetRegistry());
  afterEach(() => openHandles.splice(0).forEach((handle) => handle.close()));

  const connect = async () => {
    const { device, panel } = connectFakePair();
    const deviceClient = await getRozeniteDevToolsClient<ZustandEventMap>(ZUSTAND_PLUGIN_ID, {
      channel: device,
    });
    const panelClient = await getRozeniteDevToolsClient<ZustandEventMap>(ZUSTAND_PLUGIN_ID, {
      channel: panel,
    });
    const deviceRpc = serveZustandRpc(deviceClient);
    const panelRpc = createRozeniteRpc<ZustandMethods>(panelClient);
    const events: ZustandStoreEvent[] = [];
    panelClient.onMessage('zustand-event', (event) => events.push(event));
    openHandles.push(deviceRpc, panelRpc, deviceClient, panelClient);
    return { panelRpc, events };
  };

  const createTodos = () =>
    createTracked<{ todos: Map<string, boolean>; toggle: (id: string) => void }>(
      'Todos',
      (set) => ({
        todos: new Map([['a', false]]),
        toggle: (id) => set((s) => ({ todos: new Map(s.todos).set(id, !s.todos.get(id)) })),
      }),
    );

  it('replays history recorded before the panel connected, then streams live transitions', async () => {
    const store = createTodos();
    store.getState().toggle('a');

    const { panelRpc, events } = await connect();
    const greeting = await panelRpc.method('hello').invoke();

    expect(greeting.stores.map((s) => s.storeId)).toEqual(['Todos']);
    expect(greeting.transitions.map((t) => t.action.name)).toEqual(['toggle']);

    store.getState().toggle('a');
    await vi.waitFor(() => expect(events.some((e) => e.type === 'transitions')).toBe(true));

    // The panel rebuilds the live state from the keyframe plus every patch.
    const live = events.find((e) => e.type === 'transitions');
    const patches = [
      ...greeting.transitions,
      ...(live?.type === 'transitions' ? live.transitions : []),
    ];
    let tree = greeting.keyframes[0].state;
    for (const transition of patches) {
      tree = applyPatches(tree, transition.patches, transition.seq);
    }
    expect(tree).toMatchObject({ todos: { $t: 'map', v: [['a', false]] } });
  });

  it('invokes a store action with JSON arguments, attributed like app code', async () => {
    const store = createTodos();
    const { panelRpc } = await connect();
    await panelRpc.method('hello').invoke();

    const { result } = await panelRpc
      .method('invokeAction')
      .invoke({ storeId: 'Todos', actionPath: 'toggle', args: ['a'] });

    expect(store.getState().todos.get('a')).toBe(true);
    expect(result).toEqual({ $t: 'undef' });
    const { transitions } = await panelRpc.method('hello').invoke();
    expect(transitions.at(-1)?.action).toMatchObject({ name: 'toggle', source: 'action' });
  });

  it('serves a value that was over budget when the panel expands it', async () => {
    createTracked('Log', () => ({ log: Array.from({ length: 2000 }, (_, i) => i) }));
    const { panelRpc } = await connect();
    const greeting = await panelRpc.method('hello').invoke();
    const placeholder = (greeting.keyframes[0].state as { log: { $t: string; seq: number } }).log;
    expect(placeholder.$t).toBe('lazy');

    const { value, evicted } = await panelRpc
      .method('getLazyValue')
      .invoke({ storeId: 'Log', seq: placeholder.seq, path: ['log'] });
    expect(evicted).toBe(false);
    expect((value as number[]).length).toBe(2000);
  });

  it('answers ping with the session hello reports, so the panel can spot a reload', async () => {
    const { panelRpc } = await connect();
    const { sessionId } = await panelRpc.method('hello').invoke();
    // `listening`: the device is still streaming to this panel.
    expect(await panelRpc.method('ping').invoke()).toEqual({ sessionId, listening: true });
  });
});
