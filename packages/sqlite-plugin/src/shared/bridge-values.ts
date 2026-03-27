const SQLITE_BRIDGE_BINARY_TYPE = '__rozeniteSqliteBinary';

type SqliteEncodedBinaryValue = {
  [SQLITE_BRIDGE_BINARY_TYPE]: true;
  data: number[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';

const isEncodedBinaryValue = (
  value: unknown,
): value is SqliteEncodedBinaryValue =>
  isRecord(value) &&
  value[SQLITE_BRIDGE_BINARY_TYPE] === true &&
  Array.isArray(value.data) &&
  value.data.every((item) => typeof item === 'number');

export const encodeSqliteBridgeValue = (value: unknown): unknown => {
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return {
      [SQLITE_BRIDGE_BINARY_TYPE]: true,
      data: Array.from(value),
    } satisfies SqliteEncodedBinaryValue;
  }

  if (value instanceof ArrayBuffer) {
    return {
      [SQLITE_BRIDGE_BINARY_TYPE]: true,
      data: Array.from(new Uint8Array(value)),
    } satisfies SqliteEncodedBinaryValue;
  }

  if (Array.isArray(value)) {
    return value.map(encodeSqliteBridgeValue);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        encodeSqliteBridgeValue(nestedValue),
      ]),
    );
  }

  return String(value);
};

export const decodeSqliteBridgeValue = (value: unknown): unknown => {
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (isEncodedBinaryValue(value)) {
    return new Uint8Array(value.data);
  }

  if (Array.isArray(value)) {
    return value.map(decodeSqliteBridgeValue);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        decodeSqliteBridgeValue(nestedValue),
      ]),
    );
  }

  return value;
};

const getStringField = (value: unknown, key: string): string | null => {
  if (!isRecord(value)) {
    return null;
  }

  const field = value[key];
  if (typeof field !== 'string') {
    return null;
  }

  const trimmed = field.trim();
  return trimmed ? trimmed : null;
};

const stringifyFallback = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const describeError = (error: unknown): string | null => {
  if (error instanceof Error) {
    const code = getStringField(error, 'code');
    const reason = getStringField(error, 'reason');
    const message = error.message.trim();
    const detailParts = [message || null, reason].filter(
      (part, index, parts): part is string =>
        !!part && parts.indexOf(part) === index,
    );
    const detail = detailParts.join(' | ') || error.name;

    return code ? `[${code}] ${detail}` : detail;
  }

  if (isRecord(error)) {
    const code = getStringField(error, 'code');
    const message = getStringField(error, 'message');
    const reason = getStringField(error, 'reason');
    const detail = message ?? reason ?? stringifyFallback(error);

    return code ? `[${code}] ${detail}` : detail;
  }

  if (typeof error === 'string') {
    return error.trim() || null;
  }

  if (error == null) {
    return null;
  }

  return stringifyFallback(error);
};

const getCause = (error: unknown): unknown => {
  if (!isRecord(error)) {
    return undefined;
  }

  return error.cause;
};

export const formatSqliteError = (error: unknown): string => {
  const visited = new Set<unknown>();
  const parts: string[] = [];
  let current: unknown = error;

  while (current !== undefined && current !== null && !visited.has(current)) {
    visited.add(current);

    const description = describeError(current);
    if (description && !parts.includes(description)) {
      parts.push(description);
    }

    current = getCause(current);
  }

  return parts.join('\nCaused by: ') || 'Unknown SQLite error.';
};
