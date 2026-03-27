import { describe, expect, it } from 'vitest';
import {
  decodeSqliteBridgeValue,
  encodeSqliteBridgeValue,
  formatSqliteError,
} from '../bridge-values';

describe('sqlite bridge values', () => {
  it('round-trips Uint8Array values through a bridge-safe payload', () => {
    const original = {
      params: [new Uint8Array([1, 2, 255]), { nested: new Uint8Array([9, 8]) }],
    };

    expect(decodeSqliteBridgeValue(encodeSqliteBridgeValue(original))).toEqual(
      original,
    );
  });

  it('formats nested error details with code and cause information', () => {
    const error = Object.assign(
      new Error("Calling the 'runAsync' function has failed"),
      {
        cause: {
          code: 'ERR_INTERNAL_SQLITE_ERROR',
          reason: 'Invalid bind parameter',
        },
      },
    );

    expect(formatSqliteError(error)).toBe(
      "Calling the 'runAsync' function has failed\nCaused by: [ERR_INTERNAL_SQLITE_ERROR] Invalid bind parameter",
    );
  });
});
