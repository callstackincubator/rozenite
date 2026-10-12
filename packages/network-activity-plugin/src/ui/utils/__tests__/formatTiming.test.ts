import { describe, expect, it } from 'vitest';
import { formatTime, formatTimestamp } from '../formatTiming';

describe('formatTime', () => {
  it('shows sub-millisecond durations in microseconds', () => {
    expect(formatTime(0.25)).toBe('250 μs');
  });

  it('shows milliseconds with one decimal', () => {
    expect(formatTime(142)).toBe('142.0 ms');
    expect(formatTime(96.04)).toBe('96.0 ms');
  });
});

describe('formatTimestamp', () => {
  it('reads the timestamp as epoch milliseconds, like the device sends it', () => {
    const timestamp = new Date(2026, 2, 2, 14, 5, 9).getTime();

    expect(formatTimestamp(timestamp)).toBe(new Date(timestamp).toLocaleTimeString());
    expect(formatTimestamp(timestamp + 61_000)).toBe(
      new Date(timestamp + 61_000).toLocaleTimeString(),
    );
  });

  it('does not read the timestamp as seconds', () => {
    // Regression guard: the Timing tab used to multiply by 1000, which showed a clock time
    // unrelated to the request's real start.
    const timestamp = new Date(2026, 2, 2, 14, 5, 9).getTime();

    expect(formatTimestamp(timestamp)).not.toBe(new Date(timestamp * 1000).toLocaleTimeString());
  });
});
