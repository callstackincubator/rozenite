/**
 * Tagged JSON codec shared by the device and the panel.
 *
 * Plain JSON passes through untouched. Anything JSON cannot hold becomes a
 * tagged object `{ $t: <tag>, ... }` so the panel can render it natively and,
 * for most tags, an edit can turn it back into the real type. A value over
 * budget becomes a `lazy` placeholder the panel can fetch on demand.
 *
 * Runs on Hermes, Lynx and in the browser, so it uses no Node APIs.
 */

export type StatePath = (string | number)[];

export type EncodedTagged =
  | { $t: 'undef' }
  | { $t: 'nan' }
  | { $t: 'inf'; neg?: boolean }
  | { $t: 'negzero' }
  | { $t: 'bigint'; v: string }
  | { $t: 'date'; v: string }
  | { $t: 'regexp'; source: string; flags: string }
  | { $t: 'symbol'; v: string }
  | { $t: 'fn'; name: string; arity: number }
  | { $t: 'error'; name: string; message: string; stack?: string }
  | { $t: 'map'; v: [EncodedValue, EncodedValue][] }
  | { $t: 'set'; v: EncodedValue[] }
  | { $t: 'class'; name: string; v: { [key: string]: EncodedValue } }
  /**
   * A typed array, `DataView` or `ArrayBuffer` (`kind` is the constructor
   * name). `v` holds the elements; bytes for `DataView` and `ArrayBuffer`,
   * decimal strings for the BigInt arrays. Display only: it decodes to
   * `undefined`.
   */
  | { $t: 'typed'; kind: string; v: EncodedValue[] }
  | { $t: 'obj'; v: { [key: string]: EncodedValue } }
  | { $t: 'ref'; path: StatePath }
  | {
      $t: 'lazy';
      path: StatePath;
      seq: number;
      kind: 'string' | 'array' | 'object' | 'map' | 'set';
      size: number;
      preview?: string;
    };

export type EncodedValue =
  | null
  | boolean
  | number
  | string
  | EncodedValue[]
  | { [key: string]: EncodedValue }
  | EncodedTagged;

export type CodecBudget = {
  /** Strings longer than this many UTF-16 units become lazy. */
  maxStringLength: number;
  /** Arrays, objects, maps and sets with more entries than this become lazy. */
  maxItems: number;
  /** Containers nested deeper than this become lazy. */
  maxDepth: number;
};

export const DEFAULT_BUDGET: CodecBudget = {
  maxStringLength: 10_000,
  maxItems: 500,
  maxDepth: 32,
};

/** No budget at all: used for serving a lazy value and for agents. */
export const UNBOUNDED_BUDGET: CodecBudget = {
  maxStringLength: Number.POSITIVE_INFINITY,
  maxItems: Number.POSITIVE_INFINITY,
  maxDepth: 256,
};

export type EncodeOptions = {
  budget?: CodecBudget;
  /** Path of `value` inside the store state; recorded in lazy and ref tags. */
  path?: StatePath;
  /** Sequence number the encoded value belongs to; recorded in lazy tags. */
  seq?: number;
};

export const isTagged = (value: unknown): value is EncodedTagged =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { $t?: unknown }).$t === 'string';

export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const getConstructorName = (value: object): string => {
  const ctor = (value as { constructor?: { name?: unknown } }).constructor;
  return typeof ctor?.name === 'string' && ctor.name ? ctor.name : 'Object';
};

const previewOf = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.slice(0, 120);
  }
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (value instanceof Map) {
    return `Map(${value.size})`;
  }
  if (value instanceof Set) {
    return `Set(${value.size})`;
  }
  const binaryKind = binaryKindOf(value as object);
  if (binaryKind) {
    return `${binaryKind}(${binaryElements(value as object).length})`;
  }
  return `{${Object.keys(value as object)
    .slice(0, 5)
    .join(', ')}${Object.keys(value as object).length > 5 ? ', …' : ''}}`;
};

const encodeNumber = (input: number): EncodedValue => {
  if (Number.isNaN(input)) return { $t: 'nan' };
  if (!Number.isFinite(input)) return input > 0 ? { $t: 'inf' } : { $t: 'inf', neg: true };
  // JSON writes -0 as 0.
  if (Object.is(input, -0)) return { $t: 'negzero' };
  return input;
};

const binaryKindOf = (value: object): string | null => {
  if (typeof ArrayBuffer === 'undefined') return null;
  if (value instanceof ArrayBuffer) return 'ArrayBuffer';
  if (ArrayBuffer.isView(value)) return getConstructorName(value);
  return null;
};

const binaryElements = (value: object): ArrayLike<number | bigint> => {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value instanceof DataView) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return value as unknown as ArrayLike<number | bigint>;
};

export const encodeValue = (value: unknown, options: EncodeOptions = {}): EncodedValue => {
  const budget = options.budget ?? DEFAULT_BUDGET;
  const seq = options.seq ?? 0;
  const seen = new Map<object, StatePath>();

  const lazy = (
    raw: unknown,
    path: StatePath,
    kind: 'string' | 'array' | 'object' | 'map' | 'set',
    size: number,
  ): EncodedTagged => ({ $t: 'lazy', path, seq, kind, size, preview: previewOf(raw) });

  const encodeEntries = (
    obj: object,
    path: StatePath,
    depth: number,
  ): { [key: string]: EncodedValue } => {
    const out: { [key: string]: EncodedValue } = {};
    for (const key of Object.keys(obj)) {
      let child: unknown;
      try {
        child = (obj as Record<string, unknown>)[key];
      } catch (error) {
        child = error;
      }
      setOwn(out, key, walk(child, [...path, key], depth + 1));
    }
    return out;
  };

  const walk = (input: unknown, path: StatePath, depth: number): EncodedValue => {
    switch (typeof input) {
      case 'undefined':
        return { $t: 'undef' };
      case 'boolean':
        return input;
      case 'number':
        return encodeNumber(input);
      case 'string':
        return input.length > budget.maxStringLength
          ? lazy(input, path, 'string', input.length)
          : input;
      case 'bigint':
        return { $t: 'bigint', v: input.toString() };
      case 'symbol':
        return { $t: 'symbol', v: input.description ?? '' };
      case 'function':
        return { $t: 'fn', name: input.name || 'anonymous', arity: input.length };
      default:
        break;
    }

    if (input === null) {
      return null;
    }

    const obj = input as object;
    const seenAt = seen.get(obj);
    if (seenAt) {
      return { $t: 'ref', path: seenAt };
    }

    if (obj instanceof Date) {
      return { $t: 'date', v: Number.isNaN(obj.getTime()) ? 'Invalid Date' : obj.toISOString() };
    }
    if (obj instanceof RegExp) {
      return { $t: 'regexp', source: obj.source, flags: obj.flags };
    }
    if (obj instanceof Error) {
      return { $t: 'error', name: obj.name, message: obj.message, stack: obj.stack };
    }

    const tooDeep = depth > budget.maxDepth;

    const binaryKind = binaryKindOf(obj);
    if (binaryKind) {
      const elements = binaryElements(obj);
      if (tooDeep || elements.length > budget.maxItems) {
        return lazy(obj, path, 'array', elements.length);
      }
      return {
        $t: 'typed',
        kind: binaryKind,
        v: Array.from(elements, (item) =>
          typeof item === 'bigint' ? item.toString() : encodeNumber(item),
        ),
      };
    }

    if (Array.isArray(obj)) {
      if (tooDeep || obj.length > budget.maxItems) {
        return lazy(obj, path, 'array', obj.length);
      }
      seen.set(obj, path);
      const out = obj.map((item, index) => walk(item, [...path, index], depth + 1));
      seen.delete(obj);
      return out;
    }

    if (obj instanceof Map) {
      if (tooDeep || obj.size > budget.maxItems) {
        return lazy(obj, path, 'map', obj.size);
      }
      seen.set(obj, path);
      const entries: [EncodedValue, EncodedValue][] = [];
      let index = 0;
      for (const [key, entryValue] of obj) {
        entries.push([
          walk(key, [...path, index, 0], depth + 1),
          walk(entryValue, [...path, index, 1], depth + 1),
        ]);
        index += 1;
      }
      seen.delete(obj);
      return { $t: 'map', v: entries };
    }

    if (obj instanceof Set) {
      if (tooDeep || obj.size > budget.maxItems) {
        return lazy(obj, path, 'set', obj.size);
      }
      seen.set(obj, path);
      const items: EncodedValue[] = [];
      let index = 0;
      for (const item of obj) {
        items.push(walk(item, [...path, index], depth + 1));
        index += 1;
      }
      seen.delete(obj);
      return { $t: 'set', v: items };
    }

    const keyCount = Object.keys(obj).length;
    if (tooDeep || keyCount > budget.maxItems) {
      return lazy(obj, path, 'object', keyCount);
    }

    seen.set(obj, path);
    const entries = encodeEntries(obj, path, depth);
    seen.delete(obj);

    if (!isPlainObject(obj)) {
      return { $t: 'class', name: getConstructorName(obj), v: entries };
    }

    // A user object that happens to own a `$t` key must not be mistaken for
    // a tag, so it gets wrapped.
    if ('$t' in entries) {
      return { $t: 'obj', v: entries };
    }

    return entries;
  };

  return walk(value, options.path ?? [], 0);
};

/**
 * Reads a raw (not encoded) value at a path laid out the way `encodeValue`
 * writes it: Map entries are `[index, 0 | 1]` (key or value), Set items are
 * `[index]`, everything else is a property key.
 */
export const readRawPath = (root: unknown, path: StatePath): unknown => {
  let node = root;
  for (const segment of path) {
    if (node instanceof Map) {
      node = [...node.entries()][Number(segment)];
    } else if (node instanceof Set) {
      node = [...node.values()][Number(segment)];
    } else if (node !== null && typeof node === 'object') {
      node = (node as Record<string, unknown>)[String(segment)];
    } else {
      return undefined;
    }
  }
  return node;
};

/**
 * Decodes a value the panel or an agent sent. Functions, lazy placeholders,
 * binary data and cycles (`ref`) are not rebuilt here and decode to
 * `undefined`; class instances come back as plain objects.
 */
export const decodeValue = (value: EncodedValue): unknown => {
  const walk = (input: EncodedValue): unknown => {
    if (input === null || typeof input !== 'object') {
      return input;
    }

    if (Array.isArray(input)) {
      return input.map(walk);
    }

    if (isTagged(input)) {
      switch (input.$t) {
        case 'undef':
          return undefined;
        case 'nan':
          return Number.NaN;
        case 'inf':
          return input.neg ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
        case 'negzero':
          return -0;
        case 'bigint':
          return typeof BigInt === 'function' ? BigInt(input.v) : Number(input.v);
        case 'date':
          return new Date(input.v);
        case 'regexp':
          return new RegExp(input.source, input.flags);
        case 'symbol':
          return Symbol(input.v);
        case 'error': {
          const error = new Error(input.message);
          error.name = input.name;
          if (input.stack) {
            error.stack = input.stack;
          }
          return error;
        }
        case 'map':
          return new Map(input.v.map(([key, entryValue]) => [walk(key), walk(entryValue)]));
        case 'set':
          return new Set(input.v.map(walk));
        case 'obj':
        case 'class':
          return walkObject(input.v);
        default:
          return undefined;
      }
    }

    return walkObject(input as { [key: string]: EncodedValue });
  };

  const walkObject = (input: { [key: string]: EncodedValue }) => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(input)) {
      setOwn(out, key, walk(input[key]));
    }
    return out;
  };

  return walk(value);
};

/** Assigns an own property, including one named `__proto__`. */
const setOwn = (target: Record<string, unknown>, key: string, value: unknown) => {
  if (key === '__proto__') {
    Object.defineProperty(target, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  } else {
    target[key] = value;
  }
};

/** Human readable one-line summary of an encoded value, for timeline rows. */
export const summarizeEncoded = (value: EncodedValue, maxLength = 60): string => {
  const text = (() => {
    if (value === null) return 'null';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value !== 'object') return String(value);
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (isTagged(value)) {
      switch (value.$t) {
        case 'undef':
          return 'undefined';
        case 'nan':
          return 'NaN';
        case 'inf':
          return value.neg ? '-Infinity' : 'Infinity';
        case 'negzero':
          return '-0';
        case 'typed':
          return `${value.kind}(${value.v.length})`;
        case 'bigint':
          return `${value.v}n`;
        case 'date':
          return value.v;
        case 'regexp':
          return `/${value.source}/${value.flags}`;
        case 'symbol':
          return `Symbol(${value.v})`;
        case 'fn':
          return `ƒ ${value.name}()`;
        case 'error':
          return `${value.name}: ${value.message}`;
        case 'map':
          return `Map(${value.v.length})`;
        case 'set':
          return `Set(${value.v.length})`;
        case 'class':
          return `${value.name} {…}`;
        case 'obj':
          return `{…}`;
        case 'ref':
          return `↻ $.${value.path.join('.')}`;
        case 'lazy':
          return `${value.preview ?? value.kind} (lazy)`;
        default:
          return '?';
      }
    }
    const keys = Object.keys(value);
    return keys.length === 0
      ? '{}'
      : `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', …' : ''}}`;
  })();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
};

/** Structural equality of two encoded values. */
export const encodedEqual = (a: EncodedValue, b: EncodedValue): boolean => {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const other = b as EncodedValue[];
    return a.length === other.length && a.every((item, index) => encodedEqual(item, other[index]));
  }
  const ao = a as Record<string, EncodedValue>;
  const bo = b as Record<string, EncodedValue>;
  if (isTagged(a) && a.$t === 'lazy' && isTagged(b) && b.$t === 'lazy') {
    // `seq` only says which device state to load it from. The same unloaded
    // value reached through a keyframe and through patches carries different
    // seqs, and what is behind a placeholder cannot be compared anyway.
    return (
      a.kind === b.kind &&
      a.size === b.size &&
      a.preview === b.preview &&
      JSON.stringify(a.path) === JSON.stringify(b.path)
    );
  }
  const aKeys = Object.keys(ao);
  if (aKeys.length !== Object.keys(bo).length) return false;
  return aKeys.every((key) => key in bo && encodedEqual(ao[key], bo[key]));
};
