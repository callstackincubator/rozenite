import { describe, expect, it } from 'vitest';
import { createInspectionStore } from '../inspection-store.js';

describe('createInspectionStore', () => {
  it('stores normalized full-data payloads', () => {
    const store = createInspectionStore();

    const result = store.ingestInspectedElement({
      id: 10,
      type: 'full-data',
      value: {
        props: {
          title: {
            data: 'Hello',
          },
        },
        state: {
          count: 1,
        },
        hooks: [
          {
            name: 'State',
            value: {
              data: 'hydrated',
            },
          },
        ],
      },
    });

    expect(result).toEqual({ nodeId: 10, exists: true });
    expect(store.get(10)).toEqual({
      props: {
        title: 'Hello',
      },
      state: {
        count: 1,
      },
      hooks: [
        {
          name: 'State',
          value: 'hydrated',
        },
      ],
    });
  });

  it('removes entries on not-found payload', () => {
    const store = createInspectionStore();

    store.ingestInspectedElement({
      id: 7,
      type: 'full-data',
      value: {
        props: {
          ok: true,
        },
      },
    });

    const result = store.ingestInspectedElement({
      id: 7,
      type: 'not-found',
    });

    expect(result).toEqual({ nodeId: 7, exists: false });
    expect(store.get(7)).toBeUndefined();
  });

  it('returns null for invalid payloads', () => {
    const store = createInspectionStore();

    expect(store.ingestInspectedElement(null)).toBeNull();
    expect(store.ingestInspectedElement({ type: 'full-data' })).toBeNull();
  });
});
