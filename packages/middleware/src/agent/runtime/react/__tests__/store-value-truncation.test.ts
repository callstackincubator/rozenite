import { describe, expect, it } from 'vitest';
import { createReactTreeStore } from '../store.js';
import { createBridgeStub } from './bridge-stub.js';

const DEVICE_ID = 'device-truncate';

/**
 * A store whose device answers every `inspectElement` with the same props, so a
 * test only has to state the value whose serialization it is about.
 */
const createStore = (props: Record<string, unknown>) => {
  const store = createReactTreeStore({
    createBridge: async (options) =>
      createBridgeStub({
        send: (event, payload) => {
          options?.sendMessage?.({ event, payload });
        },
      }),
  });

  store.registerDevice(DEVICE_ID, {
    sendMessage: (message) => {
      if (message.event !== 'inspectElement') {
        return;
      }

      const { id } = message.payload as { id: number };
      void store.ingestReactDevToolsMessage(DEVICE_ID, {
        event: 'inspectedElement',
        payload: { id, type: 'full-data', value: { props } },
      });
    },
  });

  store.syncTree(DEVICE_ID, {
    roots: [1],
    nodes: [
      { nodeId: 1, displayName: 'Root', elementType: 'root', childIds: [2] },
      {
        nodeId: 2,
        displayName: 'Avatar',
        elementType: 'function',
        parentId: 1,
        rendererId: 1,
        childIds: [],
      },
    ],
  });

  return store;
};

describe('React inspected value truncation', () => {
  it('truncates a long string and says how much was cut', async () => {
    const store = createStore({ uri: 'a'.repeat(600) });

    const result = await store.getProps(DEVICE_ID, { nodeId: 2 });

    expect(result.items).toEqual([{ name: 'uri', value: `${'a'.repeat(512)}[+88 chars]` }]);
  });

  it('leaves a string within the budget untouched', async () => {
    const store = createStore({ uri: 'https://example.com/avatar.png' });

    const result = await store.getProps(DEVICE_ID, { nodeId: 2 });

    expect(result.items).toEqual([{ name: 'uri', value: 'https://example.com/avatar.png' }]);
  });

  it('honours a caller-supplied budget, nested values included', async () => {
    const store = createStore({ meta: { note: 'abcdefghij' } });

    const result = await store.getProps(DEVICE_ID, { nodeId: 2, maxValueLength: 4 });

    expect(result.items).toEqual([{ name: 'meta', value: { note: 'abcd[+6 chars]' } }]);
  });

  it('applies the budget to getComponent too', async () => {
    const store = createStore({ blob: 'x'.repeat(50) });

    const result = await store.getComponent(DEVICE_ID, {
      nodeId: 2,
      include: ['props'],
      maxValueLength: 8,
    });

    expect(result.props).toEqual({ blob: 'xxxxxxxx[+42 chars]' });
  });

  it('rejects a budget below one character', async () => {
    const store = createStore({ blob: 'x' });

    await expect(store.getProps(DEVICE_ID, { nodeId: 2, maxValueLength: 0 })).rejects.toThrow(
      '"maxValueLength" must be an integer between 1 and 8192',
    );
  });
});
