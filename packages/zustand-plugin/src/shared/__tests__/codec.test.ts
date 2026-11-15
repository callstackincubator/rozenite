import { describe, expect, it } from 'vitest';
import { decodeValue, encodedEqual, encodeValue, type EncodedValue } from '../codec';

class Point {
  constructor(
    public x: number,
    public y: number,
  ) {}
}

describe('state codec', () => {
  it('round-trips every non-JSON type time travel has to restore', () => {
    const state = {
      tags: new Set(['a', 'b']),
      byId: new Map<string, { qty: number }>([['sku-1', { qty: 2 }]]),
      at: new Date('2026-11-03T10:00:00.000Z'),
      big: BigInt(10) ** BigInt(20),
      missing: undefined,
      nan: Number.NaN,
      inf: Number.NEGATIVE_INFINITY,
      re: /ab+c/gi,
    };

    const decoded = decodeValue(
      JSON.parse(JSON.stringify(encodeValue(state))) as EncodedValue,
    ) as typeof state;

    expect(decoded.tags).toEqual(new Set(['a', 'b']));
    expect(decoded.byId).toEqual(new Map([['sku-1', { qty: 2 }]]));
    expect(decoded.at.toISOString()).toBe('2026-11-03T10:00:00.000Z');
    expect(decoded.big).toBe(BigInt(10) ** BigInt(20));
    expect('missing' in decoded && decoded.missing).toBeUndefined();
    expect(decoded.nan).toBeNaN();
    expect(decoded.inf).toBe(Number.NEGATIVE_INFINITY);
    expect(decoded.re).toEqual(/ab+c/gi);
  });

  it('round-trips -0 through JSON', () => {
    const decoded = decodeValue(JSON.parse(JSON.stringify(encodeValue({ negZero: -0 }))));
    expect(Object.is((decoded as { negZero: number }).negZero, -0)).toBe(true);
  });

  it('shows binary data but does not decode it', () => {
    const state = {
      bytes: new Uint8Array([1, 2, 255]),
      bigs: new BigInt64Array([BigInt(-1)]),
      view: new DataView(new Uint8Array([7, 8]).buffer),
    };
    const encoded = encodeValue(state);
    expect(encoded).toEqual({
      bytes: { $t: 'typed', kind: 'Uint8Array', v: [1, 2, 255] },
      bigs: { $t: 'typed', kind: 'BigInt64Array', v: ['-1'] },
      view: { $t: 'typed', kind: 'DataView', v: [7, 8] },
    });
    expect(decodeValue(encoded)).toEqual({ bytes: undefined, bigs: undefined, view: undefined });
  });

  it('makes long typed arrays lazy like any other array', () => {
    const encoded = encodeValue({ samples: new Float32Array(600) }) as {
      samples: { $t: string; kind: string; size: number };
    };
    expect(encoded.samples).toMatchObject({ $t: 'lazy', kind: 'array', size: 600 });
  });

  it('decodes class instances as plain objects', () => {
    const plain = decodeValue(encodeValue({ at: new Point(1, 2) })) as { at: object };
    expect(Object.getPrototypeOf(plain.at)).toBe(Object.prototype);
    expect(plain.at).toEqual({ x: 1, y: 2 });
  });

  it('keeps class names, function signatures and circular references legible', () => {
    const node: Record<string, unknown> = {
      point: new Point(1, 2),
      add: (a: number, b: number) => a + b,
    };
    node.self = node;

    expect(encodeValue(node)).toEqual({
      point: { $t: 'class', name: 'Point', v: { x: 1, y: 2 } },
      add: { $t: 'fn', name: 'add', arity: 2 },
      self: { $t: 'ref', path: [] },
    });
  });

  it('does not mistake a user object owning `$t` for a tag', () => {
    const encoded = encodeValue({ payload: { $t: 'map', v: 1 } });
    expect(decodeValue(encoded)).toEqual({ payload: { $t: 'map', v: 1 } });
  });

  it('replaces values over budget with lazy placeholders that know where they live', () => {
    const encoded = encodeValue(
      { list: Array.from({ length: 10 }, (_, i) => i), note: 'x'.repeat(50) },
      { budget: { maxItems: 5, maxStringLength: 20, maxDepth: 10 }, seq: 7 },
    ) as Record<string, EncodedValue>;

    expect(encoded.list).toMatchObject({
      $t: 'lazy',
      path: ['list'],
      seq: 7,
      kind: 'array',
      size: 10,
    });
    expect(encoded.note).toMatchObject({ $t: 'lazy', path: ['note'], kind: 'string', size: 50 });
  });

  it('decodes functions and lazy placeholders to undefined', () => {
    expect(
      decodeValue({
        count: 1,
        add: { $t: 'fn', name: 'add', arity: 0 },
        log: { $t: 'lazy', path: ['log'], seq: 1, kind: 'array', size: 900 },
      }),
    ).toEqual({ count: 1, add: undefined, log: undefined });
  });

  it('decodes a cycle to undefined rather than rebuilding it', () => {
    const state: Record<string, unknown> = { count: 1 };
    state.self = state;
    expect(decodeValue(encodeValue(state))).toEqual({ count: 1, self: undefined });
  });

  it('does not mistake user data for a ref', () => {
    const state = { u: { __rozeniteStateRef__: true, path: [] } };
    expect(decodeValue(encodeValue(state))).toEqual(state);
  });

  it('keeps an own __proto__ key as data', () => {
    const state = JSON.parse('{"__proto__":{"x":1},"a":2}');
    const decoded = decodeValue(encodeValue(state)) as Record<string, unknown>;
    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
    expect(Object.keys(decoded)).toEqual(['__proto__', 'a']);
  });

  it('treats the same unloaded placeholder as equal whatever seq it is loaded from', () => {
    const big = { items: Array.from({ length: 600 }, (_, index) => index) };
    expect(encodedEqual(encodeValue(big, { seq: 1 }), encodeValue(big, { seq: 50 }))).toBe(true);
  });
});
