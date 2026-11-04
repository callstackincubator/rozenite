import { createTracked } from '../../__tests__/helpers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { zustandAgentToolDefinitions } from '../../shared/agent-tools';
import {
  getStateResult,
  invokeActionResult,
  jumpToTransitionResult,
  listStoresResult,
  setRecordingResult,
  setValueResult,
} from '../agent-tools';
import { __resetRegistry, inspectStore } from '../store-registry';

type Inventory = {
  items: number[];
  byId: Map<string, { qty: number }>;
  settings: { theme: string };
  add: (n: number) => void;
};

const createInventory = (onAdd: () => void = () => undefined) =>
  createTracked<Inventory>('Inventory', (set, get) => ({
    items: Array.from({ length: 600 }, (_, index) => index),
    byId: new Map([['a', { qty: 1 }]]),
    settings: { theme: 'light' },
    add: (n: number) => {
      onAdd();
      set({ items: [...get().items, n] });
    },
  }));

beforeEach(() => __resetRegistry());

describe('state agent tools', () => {
  it('lists callable actions in the projected list-stores rows', () => {
    createInventory();
    expect(zustandAgentToolDefinitions.listStores.rows?.fields).toContain('actions');
    expect(listStoresResult().stores[0].actions).toEqual(['add']);
  });

  it('reads past the panel encoding budget', () => {
    createInventory();
    expect(getStateResult({ storeId: 'Inventory', path: 'items.599' }).state).toBe(599);
  });

  it('sets a value inside a Map entry by its state path', () => {
    const store = createInventory();
    setValueResult({ storeId: 'Inventory', path: 'byId.0.1.qty', value: 2 });
    expect(store.getState().byId.get('a')).toEqual({ qty: 2 });
    expect(() =>
      setValueResult({ storeId: 'Inventory', path: 'byId.v.0.1.qty', value: 3 }),
    ).toThrow('Path "byId.v" does not exist.');
  });

  it('rejects paths that do not exist or name the whole state', () => {
    const store = createInventory();
    expect(() =>
      setValueResult({ storeId: 'Inventory', path: 'setings.theme', value: 'x' }),
    ).toThrow('Path "setings" does not exist.');
    expect(() => setValueResult({ storeId: 'Inventory', path: '', value: 5 })).toThrow();
    expect(store.getState().settings.theme).toBe('light');

    setValueResult({ storeId: 'Inventory', path: 'settings.accent', value: 'red' });
    expect(store.getState().settings).toEqual({ theme: 'light', accent: 'red' });
  });

  it('validates argument types', () => {
    createInventory();
    expect(() => setRecordingResult({ storeId: 'Inventory', value: 'false' as never })).toThrow(
      '"value" must be true or false.',
    );
    expect(inspectStore('Inventory').descriptor.recording).toBe(true);
    return expect(invokeActionResult({ storeId: 'Inventory', action: 'toString' })).rejects.toThrow(
      '"toString" is not an action of "Inventory"',
    );
  });

  it('keeps the live actions when jumping to a transition recorded before a reload', () => {
    const stale = vi.fn();
    createInventory(stale).getState().add(1);
    const seq = inspectStore('Inventory').ring[0].seq;

    const fresh = vi.fn();
    const store = createInventory(fresh);
    jumpToTransitionResult({ storeId: 'Inventory', seq });
    store.getState().add(2);

    expect(fresh).toHaveBeenCalledTimes(1);
    expect(stale).toHaveBeenCalledTimes(1);
    expect(store.getState().items.slice(-2)).toEqual([1, 2]);
  });
});
