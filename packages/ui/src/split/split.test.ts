import { describe, expect, it } from 'vitest';
import { toPanelSize } from './split';

describe('toPanelSize', () => {
  it('converts a number to a percentage string', () => {
    expect(toPanelSize(22)).toBe('22%');
  });

  it('passes a percent string through untouched', () => {
    expect(toPanelSize('22%')).toBe('22%');
  });

  it('passes a pixel string through untouched', () => {
    expect(toPanelSize('200px')).toBe('200px');
  });

  it('leaves undefined as undefined', () => {
    expect(toPanelSize(undefined)).toBeUndefined();
  });
});
