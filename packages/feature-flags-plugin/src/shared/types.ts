export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type FeatureFlagValue = boolean | string | number | JsonValue;

export type FeatureFlagType = 'boolean' | 'string' | 'number' | 'json';

export type MaybePromise<T> = T | Promise<T>;

export type FeatureFlagsSubscription = { remove: () => void };

export type FeatureFlag = {
  key: string;
  type: FeatureFlagType;
  /** Effective value, post-override. */
  value: FeatureFlagValue;
  overridden: boolean;
};

export type FeatureFlagsProvider = {
  id: string;
  name: string;
  listFlags(): MaybePromise<FeatureFlag[]>;
  setOverride(key: string, value: FeatureFlagValue): MaybePromise<void>;
  clearOverride(key: string): MaybePromise<void>;
  clearAllOverrides(): MaybePromise<void>;
  refresh?(): MaybePromise<void>;
  subscribe?(callback: () => void): FeatureFlagsSubscription;
};

/**
 * Infers the flag type from a runtime value. Booleans, numbers, and strings
 * map directly; everything else (objects, arrays, `null`) is treated as
 * `json`.
 */
export const inferFlagType = (value: FeatureFlagValue): FeatureFlagType => {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  return 'json';
};

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }
  return false;
};

/**
 * Validates that `value` matches the declared `type`. `json` accepts any
 * JSON-serializable value, including the primitives also covered by
 * `boolean`/`number`/`string`.
 */
export const isValueOfType = (type: FeatureFlagType, value: unknown): value is FeatureFlagValue => {
  switch (type) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number';
    case 'string':
      return typeof value === 'string';
    case 'json':
      return isJsonValue(value);
    default:
      return false;
  }
};
