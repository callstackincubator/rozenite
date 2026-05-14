import { describe, expect, it } from 'vitest';
import { formatDuration, formatTime } from '../utils';

describe('formatTime', () => {
  it('renders HH:MM:SS.mmm in 24h format', () => {
    const ts = new Date(2024, 0, 15, 12, 34, 56, 789).getTime();
    expect(formatTime(ts)).toBe('12:34:56.789');
  });

  it('zero-pads single-digit hours / minutes / seconds', () => {
    const ts = new Date(2024, 0, 15, 3, 4, 5, 7).getTime();
    expect(formatTime(ts)).toBe('03:04:05.007');
  });

  it('renders midnight as 00:00:00.000', () => {
    const ts = new Date(2024, 0, 15, 0, 0, 0, 0).getTime();
    expect(formatTime(ts)).toBe('00:00:00.000');
  });

  it('renders end-of-second milliseconds as .999', () => {
    const ts = new Date(2024, 0, 15, 23, 59, 59, 999).getTime();
    expect(formatTime(ts)).toBe('23:59:59.999');
  });

  it('pads two-digit milliseconds with a leading zero', () => {
    const ts = new Date(2024, 0, 15, 10, 20, 30, 42).getTime();
    expect(formatTime(ts)).toBe('10:20:30.042');
  });
});

describe('formatDuration', () => {
  it('renders 0 as "0ms"', () => {
    expect(formatDuration(0)).toBe('0ms');
  });

  it('renders sub-millisecond non-zero values as "<1ms"', () => {
    expect(formatDuration(0.4)).toBe('<1ms');
    expect(formatDuration(0.001)).toBe('<1ms');
    expect(formatDuration(0.999)).toBe('<1ms');
  });

  it('rounds millisecond values to the nearest integer', () => {
    expect(formatDuration(1)).toBe('1ms');
    expect(formatDuration(1.4)).toBe('1ms');
    expect(formatDuration(1.5)).toBe('2ms');
    expect(formatDuration(123)).toBe('123ms');
    expect(formatDuration(123.49)).toBe('123ms');
    expect(formatDuration(123.5)).toBe('124ms');
    expect(formatDuration(999)).toBe('999ms');
    expect(formatDuration(999.4)).toBe('999ms');
  });

  it('switches to seconds with 3 decimals at the 1000ms boundary', () => {
    expect(formatDuration(1000)).toBe('1.000s');
    expect(formatDuration(1234)).toBe('1.234s');
    expect(formatDuration(60000)).toBe('60.000s');
  });

  it('rounds across the ms/s boundary before deciding the unit', () => {
    // 999.6 rounds to 1000, so it should display as 1.000s — not "1000ms".
    expect(formatDuration(999.6)).toBe('1.000s');
  });
});
