import {
  isTagged,
  summarizeEncoded,
  type EncodedTagged,
  type EncodedValue,
  type StatePath,
} from '../../shared/codec';

/** One child of a container node, with the path segment(s) that reach it. */
export type ChildEntry = {
  /** Shown as the key. */
  label: string;
  /** Key rendered from a non-string Map key (summary). */
  labelIsValue?: boolean;
  path: StatePath;
  value: EncodedValue;
};

export type NodeKind =
  | 'object'
  | 'array'
  | 'map'
  | 'set'
  | 'class'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'special'
  | 'lazy'
  | 'ref'
  | 'fn';

/** Tags that keep their own kind; every other tag is a `special` leaf. */
const TAG_KINDS: Partial<Record<EncodedTagged['$t'], NodeKind>> = {
  map: 'map',
  set: 'set',
  class: 'class',
  obj: 'object',
  lazy: 'lazy',
  ref: 'ref',
  fn: 'fn',
};

export const nodeKind = (value: EncodedValue): NodeKind => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (isTagged(value)) return TAG_KINDS[value.$t] ?? 'special';
  return typeof value === 'object' ? 'object' : (typeof value as NodeKind);
};

export const isContainer = (kind: NodeKind) =>
  kind === 'object' || kind === 'array' || kind === 'map' || kind === 'set' || kind === 'class';

/** Children of a container in display order, with the paths the device understands. */
export const childrenOf = (value: EncodedValue, path: StatePath): ChildEntry[] => {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({
      label: String(index),
      path: [...path, index],
      value: item,
    }));
  }
  if (value === null || typeof value !== 'object') return [];
  if (isTagged(value)) {
    switch (value.$t) {
      case 'map':
        return value.v.map(([key, entryValue], index) => ({
          label: typeof key === 'string' ? key : valueLabel(key),
          labelIsValue: typeof key !== 'string',
          // Device paths address a Map entry as [index, 1] (value) / [index, 0] (key).
          path: [...path, index, 1],
          value: entryValue,
        }));
      case 'set':
        return value.v.map((item, index) => ({
          label: String(index),
          path: [...path, index],
          value: item,
        }));
      case 'class':
      case 'obj':
        return Object.keys(value.v).map((key) => ({
          label: key,
          path: [...path, key],
          value: value.v[key],
        }));
      default:
        return [];
    }
  }
  return Object.keys(value).map((key) => ({
    label: key,
    path: [...path, key],
    value: (value as Record<string, EncodedValue>)[key],
  }));
};

const keyCount = (value: object) => `{${Object.keys(value).length}}`;

/**
 * One-line label for a tree row: `summarizeEncoded`, untruncated, except
 * where the tree shows more (key counts, arity, sizes, typed previews).
 */
export const valueLabel = (value: EncodedValue): string => {
  if (isTagged(value)) {
    switch (value.$t) {
      case 'obj':
        return keyCount(value.v);
      case 'class':
        return `${value.name} ${keyCount(value.v)}`;
      case 'date':
        return formatDate(value.v);
      case 'fn':
        return `ƒ ${value.name}(${value.arity > 0 ? `${value.arity} arg${value.arity === 1 ? '' : 's'}` : ''})`;
      case 'ref':
        return value.path.length === 0 ? '↻ $' : summarizeEncoded(value, Infinity);
      case 'lazy':
        return `${value.preview ?? value.kind} · ${value.size.toLocaleString()} ${value.kind === 'string' ? 'chars' : 'items'}`;
      case 'typed': {
        const shown = value.v.slice(0, 8).map((item) => summarizeEncoded(item));
        return `${value.kind}(${value.v.length}) [${shown.join(', ')}${value.v.length > 8 ? ', …' : ''}]`;
      }
      default:
        break;
    }
  } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return keyCount(value);
  }
  return summarizeEncoded(value, Infinity);
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `Date ${date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, 'Z')}`;
};

/**
 * Readable plain JSON for copying: tags become their natural JSON form
 * (Map -> object or entry list, Set -> array, Date -> ISO string, …).
 */
export const toPlainJson = (value: EncodedValue): unknown => {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(toPlainJson);
  if (isTagged(value)) {
    switch (value.$t) {
      case 'map': {
        const stringKeys = value.v.every(([key]) => typeof key === 'string');
        return stringKeys
          ? Object.fromEntries(
              value.v.map(([key, entryValue]) => [key as string, toPlainJson(entryValue)]),
            )
          : value.v.map(([key, entryValue]) => [toPlainJson(key), toPlainJson(entryValue)]);
      }
      case 'set':
      case 'typed':
        return value.v.map(toPlainJson);
      case 'negzero':
        return -0;
      case 'class':
      case 'obj':
        return Object.fromEntries(
          Object.entries(value.v).map(([key, entry]) => [key, toPlainJson(entry)]),
        );
      case 'date':
        return value.v;
      case 'undef':
        return null;
      default:
        return valueLabel(value);
    }
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, EncodedValue>).map(([key, entry]) => [
      key,
      toPlainJson(entry),
    ]),
  );
};

export const stringifyForCopy = (value: EncodedValue) => {
  const plain = toPlainJson(value);
  return typeof plain === 'string' ? plain : JSON.stringify(plain, null, 2);
};

/**
 * Parses what a user typed into an edit field. JSON first; `undefined`,
 * `NaN` and `123n` are accepted as their encoded forms; anything else is an
 * error rather than a silently stringified value.
 */
export const parseUserValue = (
  text: string,
): { ok: true; value: EncodedValue } | { ok: false; error: string } => {
  const trimmed = text.trim();
  if (trimmed === 'undefined') return { ok: true, value: { $t: 'undef' } };
  if (trimmed === 'NaN') return { ok: true, value: { $t: 'nan' } };
  if (trimmed === 'Infinity') return { ok: true, value: { $t: 'inf' } };
  if (trimmed === '-Infinity') return { ok: true, value: { $t: 'inf', neg: true } };
  // JSON (and so the bridge) writes -0 as 0.
  if (trimmed === '-0') return { ok: true, value: { $t: 'negzero' } };
  if (/^-?\d+n$/.test(trimmed))
    return { ok: true, value: { $t: 'bigint', v: trimmed.slice(0, -1) } };
  try {
    return { ok: true, value: JSON.parse(trimmed) as EncodedValue };
  } catch (error) {
    return { ok: false, error: `Not valid JSON: ${(error as Error).message}` };
  }
};

/**
 * Text shown in the edit field for an existing value. `parseUserValue` reads
 * it back as the same value, so saving it unchanged keeps the type: a Date
 * stays a Date rather than becoming its ISO string.
 */
export const editText = (value: EncodedValue): string => {
  if (value !== null && typeof value === 'object' && isTagged(value)) {
    switch (value.$t) {
      case 'undef':
        return 'undefined';
      case 'nan':
        return 'NaN';
      case 'negzero':
        return '-0';
      case 'inf':
        return value.neg ? '-Infinity' : 'Infinity';
      case 'bigint':
        return `${value.v}n`;
      // JSON has no form for these: the tag is the edit text.
      case 'date':
      case 'regexp':
        return JSON.stringify(value);
      default:
        break;
    }
  }
  return JSON.stringify(toPlainJson(value));
};

/**
 * Leaves an edit cannot give back as they were: a symbol would come back as
 * a new symbol (`===` fails), an error as a plain `Error`, binary data
 * (typed arrays, `ArrayBuffer`, `DataView`) not at all -- the device does not
 * decode it. Functions, refs and unloaded values are not values to type.
 */
const READ_ONLY_TAGS = new Set<EncodedTagged['$t']>([
  'symbol',
  'error',
  'typed',
  'fn',
  'ref',
  'lazy',
]);

export const isEditableLeaf = (value: EncodedValue): boolean =>
  !(isTagged(value) && READ_ONLY_TAGS.has(value.$t));

export const pathKey = (path: StatePath) => JSON.stringify(path);

/**
 * Paths (as `pathKey`) of every node whose key or primitive value contains
 * `query`, plus all their ancestors -- what a filtered tree shows expanded.
 */
export const searchTree = (root: EncodedValue, query: string): Set<string> => {
  const needle = query.trim().toLowerCase();
  const visible = new Set<string>();
  if (!needle) return visible;

  const visit = (
    value: EncodedValue,
    path: StatePath,
    label: string,
    ancestors: string[],
  ): boolean => {
    const key = pathKey(path);
    const kind = nodeKind(value);
    let hit = label.toLowerCase().includes(needle);
    if (!isContainer(kind)) {
      const text = typeof value === 'string' ? value : valueLabel(value);
      hit = hit || text.toLowerCase().includes(needle);
    }
    let childHit = false;
    if (isContainer(kind)) {
      for (const child of childrenOf(value, path)) {
        if (visit(child.value, child.path, child.label, [...ancestors, key])) childHit = true;
      }
    }
    if (hit || childHit) {
      visible.add(key);
      ancestors.forEach((ancestor) => visible.add(ancestor));
    }
    return hit || childHit;
  };

  visit(root, [], '', []);
  return visible;
};
