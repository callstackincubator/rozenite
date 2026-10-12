import { describe, expect, it } from 'vitest';
import { formatClockTime, parseUrl } from '../memoized';

describe('formatClockTime', () => {
  it('shows a 24-hour clock time with milliseconds', () => {
    expect(formatClockTime(new Date(2026, 2, 2, 14, 5, 9, 42).getTime())).toBe('14:05:09.042');
    expect(formatClockTime(new Date(2026, 2, 2, 9, 30, 0, 7).getTime())).toBe('09:30:00.007');
  });

  it('shows the hour after midnight as 00, not 24', () => {
    expect(formatClockTime(new Date(2026, 2, 2, 0, 5, 9, 1).getTime())).toBe('00:05:09.001');
  });

  it('gives the same text every time for the same timestamp', () => {
    const timestamp = new Date(2026, 2, 2, 14, 5, 9, 42).getTime();

    expect(formatClockTime(timestamp)).toBe(formatClockTime(timestamp));
  });
});

describe('parseUrl', () => {
  it('splits a URL into its parts', () => {
    expect(parseUrl('https://api.shop.dev:8443/v2/items?page=1#top')).toEqual({
      hostname: 'api.shop.dev',
      pathname: '/v2/items',
      search: '?page=1',
      hash: '#top',
      port: '8443',
    });
  });

  it('returns null for something that is not a URL, every time', () => {
    expect(parseUrl('not a url')).toBeNull();
    expect(parseUrl('not a url')).toBeNull();
  });
});
