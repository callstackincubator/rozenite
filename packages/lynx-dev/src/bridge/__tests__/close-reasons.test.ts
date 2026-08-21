import { describe, expect, it } from 'vitest';
import {
  CONNECTION_LOST_CLOSE_REASON,
  getCloseReason,
  NEW_DEBUGGER_OPENED_CLOSE_REASON,
  PAGE_NOT_FOUND_CLOSE_REASON,
  RECREATING_DEVICE_CLOSE_REASON,
} from '../close-reasons.js';

describe('close reason constants', () => {
  it('match the exact bracketed strings device-connection.ts matches on', () => {
    expect(RECREATING_DEVICE_CLOSE_REASON).toBe('[RECREATING_DEVICE]');
    expect(PAGE_NOT_FOUND_CLOSE_REASON).toBe('[PAGE_NOT_FOUND]');
    expect(CONNECTION_LOST_CLOSE_REASON).toBe('[CONNECTION_LOST]');
    expect(NEW_DEBUGGER_OPENED_CLOSE_REASON).toBe('[NEW_DEBUGGER_OPENED]');
  });
});

describe('getCloseReason', () => {
  it('maps every bridge cause to a reason string', () => {
    expect(getCloseReason('client-disconnected')).toBe(RECREATING_DEVICE_CLOSE_REASON);
    expect(getCloseReason('session-gone')).toBe(PAGE_NOT_FOUND_CLOSE_REASON);
    expect(getCloseReason('transport-lost')).toBe(CONNECTION_LOST_CLOSE_REASON);
    expect(getCloseReason('superseded')).toBe(NEW_DEBUGGER_OPENED_CLOSE_REASON);
  });

  it('only ever returns one of the three recoverable reasons for a recoverable cause', () => {
    const recoverableCauses = ['client-disconnected', 'session-gone', 'transport-lost'] as const;
    const recoverableReasons = new Set([
      RECREATING_DEVICE_CLOSE_REASON,
      PAGE_NOT_FOUND_CLOSE_REASON,
      CONNECTION_LOST_CLOSE_REASON,
    ]);
    for (const cause of recoverableCauses) {
      expect(recoverableReasons.has(getCloseReason(cause))).toBe(true);
    }
  });

  it('maps "superseded" to the one terminal reason', () => {
    expect(getCloseReason('superseded')).toBe(NEW_DEBUGGER_OPENED_CLOSE_REASON);
  });
});
