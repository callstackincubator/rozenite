import { describe, expect, it } from 'vitest';
import { encodeValue } from '../codec';
import { applyPatches, diffStates } from '../patch';

describe('diffStates', () => {
  it('reports only the changed leaf of an immutably updated tree', () => {
    const items = [
      { id: 1, qty: 1 },
      { id: 2, qty: 1 },
    ];
    const prev = { cart: { items, total: 2 }, user: { name: 'Ada' }, add: () => undefined };
    const next = {
      ...prev,
      cart: { items: [items[0], { ...items[1], qty: 3 }], total: 4 },
      add: () => undefined,
    };

    expect(diffStates(prev, next)).toEqual([
      { op: 'replace', path: ['cart', 'items', 1, 'qty'], value: 3, old: 1 },
      { op: 'replace', path: ['cart', 'total'], value: 4, old: 2 },
    ]);
  });

  it('replaces a container wholesale once it would produce too many patches', () => {
    const prev = { list: Array.from({ length: 100 }, (_, i) => i) };
    const next = { list: [-1, ...prev.list] };

    const patches = diffStates(prev, next);
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({ op: 'replace', path: ['list'] });
  });

  it('never truncates the root: every changed top-level key gets its patch', () => {
    const prev = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`k${i}`, i]));
    const next = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`k${i}`, i + 1]));

    const patches = diffStates(prev, next);
    expect(patches).toHaveLength(60);
    expect(applyPatches(encodeValue(prev), patches, 1)).toEqual(encodeValue(next));
  });

  it('points lazy old values at the previous seq and new values at this one', () => {
    const list = Array.from({ length: 20 }, (_, i) => i);
    const byId = Object.fromEntries(list.map((i) => [`id${i}`, i]));
    const patches = diffStates(
      { list },
      { list: byId },
      {
        seq: 7,
        budget: { maxItems: 5, maxDepth: 32, maxStringLength: 100 },
      },
    );
    expect(patches).toEqual([
      expect.objectContaining({
        op: 'replace',
        path: ['list'],
        value: expect.objectContaining({ $t: 'lazy', seq: 7 }),
        old: expect.objectContaining({ $t: 'lazy', seq: 6 }),
      }),
    ]);
  });
});

describe('applyPatches', () => {
  it('reconstructs the next state and shares untouched branches', () => {
    const prev = { a: { deep: 1 }, b: { untouched: true }, list: [1, 2, 3] };
    const next = { ...prev, a: { deep: 2 }, list: [1, 2], extra: 'new' };
    const base = encodeValue(prev);

    const tree = applyPatches(base, diffStates(prev, next), 1);

    expect(tree).toEqual(encodeValue(next));
    expect((tree as Record<string, unknown>).b).toBe((base as Record<string, unknown>).b);
  });

  it('drops a patch whose target is missing and applies the rest', () => {
    const tree = applyPatches(
      encodeValue({ items: [] as string[], count: 0 }),
      [
        { op: 'replace', path: ['items', 0, 'name'], value: 'oat milk', old: 'milk' },
        { op: 'replace', path: ['count'], value: 1, old: 0 },
      ],
      2,
    );
    expect(tree).toEqual({ items: [], count: 1 });
  });

  it('keeps a lazy placeholder and moves it to the newer sequence', () => {
    const tree = { big: { $t: 'lazy', path: ['big'], seq: 1, kind: 'array', size: 900 } } as const;
    const next = applyPatches(
      tree as never,
      [{ op: 'replace', path: ['big', 3], value: 1, old: 0 }],
      5,
    );
    expect(next).toEqual({ big: { ...tree.big, seq: 5 } });
  });
});

describe('diffStates edge keys', () => {
  it('diffs keys named like Object.prototype members as plain data', () => {
    expect(diffStates({}, { constructor: 1 })).toEqual([
      { op: 'add', path: ['constructor'], value: 1 },
    ]);
    expect(diffStates({ toString: 'x' }, {})).toEqual([
      { op: 'remove', path: ['toString'], old: 'x' },
    ]);
  });

  it('replaces an object that gains a $t key, so its encoding stays valid', () => {
    const prev = { payload: { a: 1 } };
    const next = { payload: { a: 1, $t: 'map' } };
    expect(applyPatches(encodeValue(prev), diffStates(prev, next), 1)).toEqual(encodeValue(next));
  });
});
