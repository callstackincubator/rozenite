import { afterEach, describe, expect, it, vi } from 'vitest';
import { isLynx } from './web.js';

describe('isLynx', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when there is no lynx global', () => {
    expect(isLynx()).toBe(false);
  });

  it('returns false when lynx exists but has no getDevtool', () => {
    vi.stubGlobal('lynx', {});

    expect(isLynx()).toBe(false);
  });

  it('returns false when lynx.getDevtool is not callable', () => {
    vi.stubGlobal('lynx', { getDevtool: 'not-a-function' });

    expect(isLynx()).toBe(false);
  });

  it('returns false when lynx is not an object', () => {
    vi.stubGlobal('lynx', 'not-an-object');

    expect(isLynx()).toBe(false);
  });

  it('returns true when lynx.getDevtool is callable', () => {
    vi.stubGlobal('lynx', { getDevtool: () => ({}) });

    expect(isLynx()).toBe(true);
  });
});
