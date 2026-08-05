export type JsonNodeType =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'function'
  | 'symbol'
  | 'bigint';

const EXPANDABLE_TYPES: ReadonlySet<JsonNodeType> = new Set([
  'object',
  'array',
]);

/** Classifies a value into the leaf/container type used to render it. */
export function classifyValue(value: unknown): JsonNodeType {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  const type = typeof value;

  if (type === 'object') {
    return 'object';
  }

  return type as JsonNodeType;
}

/** Whether a value renders as an expandable tree node rather than a leaf. */
export function isExpandable(value: unknown): boolean {
  return EXPANDABLE_TYPES.has(classifyValue(value));
}

/**
 * Ordered child keys for an expandable value (array indices as strings for
 * arrays, own enumerable keys for objects). `undefined` for leaf values.
 */
export function getChildKeys(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.map((_, index) => String(index));
  }

  if (classifyValue(value) === 'object') {
    return Object.keys(value as object);
  }

  return undefined;
}

/** Human-readable summary shown next to a collapsed container, e.g. "{3}" or "[0]". */
export function getContainerSummary(value: unknown): string {
  const keys = getChildKeys(value) ?? [];
  return Array.isArray(value) ? `[${keys.length}]` : `{${keys.length}}`;
}
