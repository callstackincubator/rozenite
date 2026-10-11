/**
 * Depth- and length-bounded snapshots of arbitrary values (ADR 0004,
 * decision 7). Mirrors the knobs and markers of the React domain's
 * `getComponent`: strings longer than `maxValueLength` end in `[+N chars]`,
 * and containers deeper than `maxDepth` collapse to `[object(N keys)]` or
 * `[array(N)]`. `path` selects a sub-tree before the bounds apply.
 *
 * Runs on the device, so it must stay free of Node APIs.
 */
export const DEFAULT_MAX_DEPTH = 4;
export const MAX_MAX_DEPTH = 64;
export const DEFAULT_MAX_VALUE_LENGTH = 512;
export const MAX_MAX_VALUE_LENGTH = 1_048_576;

export type BoundedValueArgs = {
  /** Dot path selecting a sub-tree, for example `todos.items.0`. */
  path?: string;
  /** Levels below the returned value that are expanded. Defaults to 4. */
  maxDepth?: number;
  /** Longest string returned before it is cut. Defaults to 512. */
  maxValueLength?: number;
};

export type BoundedValueOptions = {
  path: string[] | undefined;
  maxDepth: number;
  maxValueLength: number;
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

export const normalizeBoundedValueArgs = (args: BoundedValueArgs = {}): BoundedValueOptions => ({
  path: parseValuePath(args.path),
  maxDepth: normalizeInteger(args.maxDepth, 'maxDepth', DEFAULT_MAX_DEPTH, 0, MAX_MAX_DEPTH),
  maxValueLength: normalizeInteger(
    args.maxValueLength,
    'maxValueLength',
    DEFAULT_MAX_VALUE_LENGTH,
    1,
    MAX_MAX_VALUE_LENGTH,
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
    const segment = segments[index];
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

/**
 * Returns a JSON-safe copy of `value` cut to `maxDepth` levels and
 * `maxValueLength` characters per string, and whether anything was cut.
 */
export const boundValue = (
  value: unknown,
  { maxDepth, maxValueLength }: Pick<BoundedValueOptions, 'maxDepth' | 'maxValueLength'>,
): { value: unknown; truncated: boolean } => {
  let truncated = false;
  const ancestors: object[] = [];

  const visit = (current: unknown, depth: number): unknown => {
    if (typeof current === 'string') {
      if (current.length <= maxValueLength) {
        return current;
      }
      truncated = true;
      return `${current.slice(0, maxValueLength)}[+${current.length - maxValueLength} chars]`;
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
      const result = current.map((item) => visit(item, depth + 1));
      ancestors.pop();
      return result;
    }

    const entries = Object.entries(current as Record<string, unknown>);
    if (depth >= maxDepth) {
      truncated = true;
      return `[object(${entries.length} keys)]`;
    }
    ancestors.push(current);
    const result = Object.fromEntries(entries.map(([key, item]) => [key, visit(item, depth + 1)]));
    ancestors.pop();
    return result;
  };

  return { value: visit(value, 0), truncated };
};
