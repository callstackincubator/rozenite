/**
 * Depth-, length- and width-bounded snapshots of arbitrary values (ADR 0004,
 * decision 7), for tools that return a store, a query's data or another
 * serialized value. The knobs and markers follow the React domain's
 * `getComponent`:
 *
 * - a string longer than `maxValueLength` UTF-16 units is cut and ends in
 *   `[+N chars]`; the cut never splits a surrogate pair;
 * - an array longer than `maxItems` keeps its first `maxItems` items and
 *   ends in one more item, the string `[+N items]`;
 * - an object with more than `maxItems` keys keeps its first `maxItems`
 *   entries and ends in one more, `"[+N keys]": true`;
 * - a container deeper than `maxDepth` collapses to `[object(N keys)]` or
 *   `[array(N)]`;
 * - `path` selects a sub-tree before any bound applies.
 *
 * Runs on the device (Hermes, Lynx) and in the browser, so it uses no Node
 * APIs.
 */

export const BOUNDED_VALUE_DEFAULTS = {
  maxDepth: 4,
  maxValueLength: 512,
  maxItems: 100,
} as const;

export const BOUNDED_VALUE_LIMITS = {
  maxDepth: 64,
  maxValueLength: 1_048_576,
  maxItems: 10_000,
} as const;

export type BoundedValueArgs = {
  /** Dot path selecting a sub-tree, for example `todos.items.0`. */
  path?: string;
  /** Levels below the returned value that are expanded. Defaults to 4, at most 64. */
  maxDepth?: number;
  /** Longest string returned before it is cut. Defaults to 512, at most 1 048 576. */
  maxValueLength?: number;
  /** Most array items or object keys returned per level. Defaults to 100, at most 10 000. */
  maxItems?: number;
};

export type BoundedValueOptions = {
  path: string[] | undefined;
  maxDepth: number;
  maxValueLength: number;
  maxItems: number;
};

export type BoundedValue = {
  value: unknown;
  /** Whether any string, container or level was cut. */
  truncated: boolean;
};

const normalizeInteger = (
  value: unknown,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number => {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new Error(`"${name}" must be an integer of at least ${min}.`);
  }
  return Math.min(value, max);
};

/** Splits a dot path into segments; `undefined` for no path. */
export const parseValuePath = (path: unknown): string[] | undefined => {
  if (path === undefined || path === '') {
    return undefined;
  }
  if (typeof path !== 'string') {
    throw new Error('"path" must be a dot-separated string.');
  }
  const segments = path.split('.');
  if (segments.some((segment) => segment.length === 0)) {
    throw new Error(`"path" "${path}" has an empty segment.`);
  }
  return segments;
};

/** Validates the bound arguments of a tool call and applies the defaults. */
export const normalizeBoundedValueArgs = (args: BoundedValueArgs = {}): BoundedValueOptions => ({
  path: parseValuePath(args.path),
  maxDepth: normalizeInteger(
    args.maxDepth,
    'maxDepth',
    BOUNDED_VALUE_DEFAULTS.maxDepth,
    0,
    BOUNDED_VALUE_LIMITS.maxDepth,
  ),
  maxValueLength: normalizeInteger(
    args.maxValueLength,
    'maxValueLength',
    BOUNDED_VALUE_DEFAULTS.maxValueLength,
    1,
    BOUNDED_VALUE_LIMITS.maxValueLength,
  ),
  maxItems: normalizeInteger(
    args.maxItems,
    'maxItems',
    BOUNDED_VALUE_DEFAULTS.maxItems,
    1,
    BOUNDED_VALUE_LIMITS.maxItems,
  ),
});

/**
 * Follows `segments` into `value`, throwing when a segment does not exist.
 * `prefix` is the part of the path already consumed, used in the error.
 */
export const selectValuePath = (
  value: unknown,
  segments: readonly string[],
  prefix: readonly string[] = [],
): unknown => {
  let current = value;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    if (
      current === null ||
      typeof current !== 'object' ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      throw new Error(
        `Path "${[...prefix, ...segments.slice(0, index + 1)].join('.')}" does not exist.`,
      );
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;

/**
 * Cuts `text` to at most `maxLength` UTF-16 units, one fewer when the last
 * kept unit would be the first half of a surrogate pair.
 */
export const truncateString = (
  text: string,
  maxLength: number,
): { text: string; truncated: boolean } => {
  if (text.length <= maxLength) {
    return { text, truncated: false };
  }
  let kept = maxLength;
  if (kept > 0 && isHighSurrogate(text.charCodeAt(kept - 1))) {
    kept -= 1;
  }
  return { text: `${text.slice(0, kept)}[+${text.length - kept} chars]`, truncated: true };
};

/**
 * Returns a JSON-safe copy of `value` cut to the bounds, and whether
 * anything was cut. Arguments are validated as {@link normalizeBoundedValueArgs}
 * does; a `path` selects the sub-tree first and throws when it does not exist.
 */
export const boundValue = (value: unknown, args: BoundedValueArgs = {}): BoundedValue => {
  const { path, maxDepth, maxValueLength, maxItems } = normalizeBoundedValueArgs(args);
  let truncated = false;
  const ancestors: object[] = [];

  const visit = (current: unknown, depth: number): unknown => {
    if (typeof current === 'string') {
      const cut = truncateString(current, maxValueLength);
      truncated = truncated || cut.truncated;
      return cut.text;
    }

    if (
      current === null ||
      current === undefined ||
      typeof current === 'boolean' ||
      typeof current === 'number'
    ) {
      return current;
    }

    if (typeof current !== 'object') {
      return String(current);
    }

    if (ancestors.includes(current)) {
      return '[circular]';
    }

    if (Array.isArray(current)) {
      if (depth >= maxDepth) {
        truncated = true;
        return `[array(${current.length})]`;
      }
      ancestors.push(current);
      const kept = current.slice(0, maxItems).map((item) => visit(item, depth + 1));
      ancestors.pop();
      if (current.length > maxItems) {
        truncated = true;
        kept.push(`[+${current.length - maxItems} items]`);
      }
      return kept;
    }

    const entries = Object.entries(current as Record<string, unknown>);
    if (depth >= maxDepth) {
      truncated = true;
      return `[object(${entries.length} keys)]`;
    }
    ancestors.push(current);
    const result: Record<string, unknown> = {};
    for (const [key, item] of entries.slice(0, maxItems)) {
      result[key] = visit(item, depth + 1);
    }
    ancestors.pop();
    if (entries.length > maxItems) {
      truncated = true;
      result[`[+${entries.length - maxItems} keys]`] = true;
    }
    return result;
  };

  return { value: visit(path ? selectValuePath(value, path) : value, 0), truncated };
};
