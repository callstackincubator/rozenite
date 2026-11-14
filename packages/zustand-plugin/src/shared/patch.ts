import {
  encodeValue,
  isPlainObject,
  isTagged,
  type CodecBudget,
  type EncodedTagged,
  type EncodedValue,
  type StatePath,
} from './codec';

const hasOwn = (target: object, key: string) => Object.prototype.hasOwnProperty.call(target, key);

/**
 * One change between two consecutive states. `old` is always present for
 * `replace` and `remove`: the diff view renders it.
 */
export type StatePatch =
  | { op: 'add'; path: StatePath; value: EncodedValue }
  | { op: 'remove'; path: StatePath; old: EncodedValue }
  | { op: 'replace'; path: StatePath; value: EncodedValue; old: EncodedValue };

export type DiffOptions = {
  budget?: CodecBudget;
  /**
   * Sequence of `next`; lazy placeholders in `value` load from it, those in
   * `old` from `seq - 1` (device transitions are consecutive).
   */
  seq?: number;
};

/**
 * When one container produces more patches than this, the container is
 * replaced as a whole instead. Keeps a prepend to a long list from turning
 * into hundreds of index shifts. The root has no parent to collapse into, so
 * it is never truncated.
 */
const MAX_PATCHES_PER_CONTAINER = 50;

const isDiffable = (value: unknown): value is Record<string, unknown> | unknown[] =>
  Array.isArray(value) || isPlainObject(value);

/**
 * Diffs two states by reference. Zustand state is immutable by convention, so
 * an unchanged branch keeps its reference and is skipped without being
 * visited. Functions on both sides count as equal: they are the store's
 * actions, recreated on every Fast Refresh, and never part of a snapshot.
 */
export const diffStates = (
  prev: unknown,
  next: unknown,
  options: DiffOptions = {},
): StatePatch[] => {
  const { budget, seq } = options;
  const prevSeq = seq === undefined ? undefined : seq - 1;
  const encode = (value: unknown, path: StatePath) => encodeValue(value, { budget, path, seq });
  const encodeOld = (value: unknown, path: StatePath) =>
    encodeValue(value, { budget, path, seq: prevSeq });

  const walk = (a: unknown, b: unknown, path: StatePath, out: StatePatch[]): void => {
    if (Object.is(a, b)) {
      return;
    }
    if (typeof a === 'function' && typeof b === 'function') {
      return;
    }

    const bothArrays = Array.isArray(a) && Array.isArray(b);
    const bothObjects = !bothArrays && isPlainObject(a) && isPlainObject(b);

    // A plain object gaining or losing an own `$t` key changes its encoding
    // (it gets wrapped as an `obj` tag), so no key-level patch can express it.
    const wrapChanges = bothObjects && hasOwn(a as object, '$t') !== hasOwn(b as object, '$t');

    if ((!bothArrays && !bothObjects) || wrapChanges) {
      out.push({ op: 'replace', path, value: encode(b, path), old: encodeOld(a, path) });
      return;
    }

    const limit = path.length > 0 ? MAX_PATCHES_PER_CONTAINER : Number.POSITIVE_INFINITY;
    const local: StatePatch[] = [];

    if (bothArrays) {
      const left = a as unknown[];
      const right = b as unknown[];
      const shared = Math.min(left.length, right.length);
      for (let index = 0; index < shared; index += 1) {
        walk(left[index], right[index], [...path, index], local);
        if (local.length > limit) break;
      }
      for (let index = left.length - 1; index >= right.length; index -= 1) {
        local.push({
          op: 'remove',
          path: [...path, index],
          old: encodeOld(left[index], [...path, index]),
        });
        if (local.length > limit) break;
      }
      for (let index = left.length; index < right.length; index += 1) {
        local.push({
          op: 'add',
          path: [...path, index],
          value: encode(right[index], [...path, index]),
        });
        if (local.length > limit) break;
      }
    } else {
      const left = a as Record<string, unknown>;
      const right = b as Record<string, unknown>;
      for (const key of Object.keys(left)) {
        if (!hasOwn(right, key)) {
          if (typeof left[key] !== 'function') {
            local.push({
              op: 'remove',
              path: [...path, key],
              old: encodeOld(left[key], [...path, key]),
            });
          }
        } else {
          walk(left[key], right[key], [...path, key], local);
        }
        if (local.length > limit) break;
      }
      if (local.length <= limit) {
        for (const key of Object.keys(right)) {
          if (!hasOwn(left, key) && typeof right[key] !== 'function') {
            local.push({
              op: 'add',
              path: [...path, key],
              value: encode(right[key], [...path, key]),
            });
            if (local.length > limit) break;
          }
        }
      }
    }

    if (local.length > limit) {
      out.push({ op: 'replace', path, value: encode(b, path), old: encodeOld(a, path) });
      return;
    }

    out.push(...local);
  };

  const out: StatePatch[] = [];
  if (!isDiffable(prev) || !isDiffable(next)) {
    if (!Object.is(prev, next)) {
      out.push({ op: 'replace', path: [], value: encode(next, []), old: encodeOld(prev, []) });
    }
    return out;
  }
  walk(prev, next, [], out);
  return out;
};

// ---------------------------------------------------------------------------
// Panel side: applying patches to encoded trees with structural sharing.
// ---------------------------------------------------------------------------

type Container =
  | { kind: 'array'; value: EncodedValue[] }
  | {
      kind: 'object';
      value: Record<string, EncodedValue>;
      wrap?: (v: Record<string, EncodedValue>) => EncodedValue;
    };

const openContainer = (node: EncodedValue): Container | null => {
  if (Array.isArray(node)) {
    return { kind: 'array', value: node };
  }
  if (node === null || typeof node !== 'object') {
    return null;
  }
  if (isTagged(node)) {
    if (node.$t === 'obj') {
      return { kind: 'object', value: node.v, wrap: (v) => ({ $t: 'obj', v }) };
    }
    if (node.$t === 'class') {
      const name = node.name;
      return { kind: 'object', value: node.v, wrap: (v) => ({ $t: 'class', name, v }) };
    }
    return null;
  }
  return { kind: 'object', value: node as Record<string, EncodedValue> };
};

/** Child `segment` of an encoded container, or `undefined` when it has none. */
const childAt = (node: EncodedValue, segment: string | number): EncodedValue | undefined => {
  const container = openContainer(node);
  if (!container) return undefined;
  if (container.kind === 'array') return container.value[Number(segment)];
  const key = String(segment);
  return hasOwn(container.value, key) ? container.value[key] : undefined;
};

/** The lazy placeholder sitting on `path` (at or above the target), and its depth. */
const findLazyAncestor = (
  tree: EncodedValue,
  path: StatePath,
): { depth: number; placeholder: Extract<EncodedTagged, { $t: 'lazy' }> } | null => {
  let node: EncodedValue | undefined = tree;
  for (let depth = 0; depth < path.length && node !== undefined; depth += 1) {
    if (isTagged(node) && node.$t === 'lazy') return { depth, placeholder: node };
    node = childAt(node, path[depth]);
  }
  return null;
};

/**
 * Immutable set or remove at `path`. A missing segment on the way leaves the
 * tree as it was (the input is returned).
 */
const setIn = (
  node: EncodedValue,
  path: StatePath,
  op: 'set' | 'remove',
  value: EncodedValue | undefined,
): EncodedValue => {
  if (path.length === 0) return value as EncodedValue;
  const [segment, ...rest] = path;
  const container = openContainer(node);
  const current = childAt(node, segment);
  // Removing what is not there, or walking through it, changes nothing.
  if (!container || (current === undefined && (rest.length > 0 || op === 'remove'))) return node;
  const remove = rest.length === 0 && op === 'remove';
  const child = remove ? undefined : setIn(current as EncodedValue, rest, op, value);
  if (rest.length > 0 && child === current) return node;

  if (container.kind === 'array') {
    const next = container.value.slice();
    if (remove) next.splice(Number(segment), 1);
    else next[Number(segment)] = child as EncodedValue;
    return next;
  }
  const next = { ...container.value };
  if (remove) delete next[String(segment)];
  else next[String(segment)] = child as EncodedValue;
  return container.wrap ? container.wrap(next) : next;
};

/**
 * Applies patches to an encoded tree, sharing every untouched branch with the
 * input. A patch whose target is missing is dropped; device keyframes correct
 * any drift that leaves behind.
 */
export const applyPatches = (
  tree: EncodedValue,
  patches: readonly StatePatch[],
  seq: number,
): EncodedValue => {
  let current = tree;

  for (const patch of patches) {
    const lazy = findLazyAncestor(current, patch.path);
    if (lazy) {
      // The panel holds only a placeholder for this subtree. Keep the
      // placeholder but point it at the newer sequence so expanding it loads
      // the up-to-date value.
      current = setIn(current, patch.path.slice(0, lazy.depth), 'set', {
        ...lazy.placeholder,
        seq,
      });
      continue;
    }
    current =
      patch.op === 'remove'
        ? setIn(current, patch.path, 'remove', undefined)
        : setIn(current, patch.path, 'set', patch.value);
  }

  return current;
};

export const formatPath = (path: StatePath): string =>
  path.length === 0
    ? '$'
    : path
        .map((segment, index) =>
          typeof segment === 'number'
            ? `[${segment}]`
            : /^[A-Za-z_$][\w$]*$/.test(segment)
              ? `${index === 0 ? '' : '.'}${segment}`
              : `[${JSON.stringify(segment)}]`,
        )
        .join('');
