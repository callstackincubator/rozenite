import { afterEach, describe, expect, it, vi } from 'vitest';
import { isLynx, isLynxMainThread } from './web.js';

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

describe('the two Lynx runtimes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats a Lynx runtime with no __BACKGROUND__ flag as the background one', () => {
    // React Native and web never define the flag, and have no second
    // runtime to be confused with.
    vi.stubGlobal('lynx', { getDevtool: () => ({}) });

    expect(isLynx()).toBe(true);
    expect(isLynxMainThread()).toBe(false);
  });

  it('reports the background runtime as Lynx', () => {
    vi.stubGlobal('lynx', { getDevtool: () => ({}) });
    vi.stubGlobal('__BACKGROUND__', true);

    expect(isLynx()).toBe(true);
    expect(isLynxMainThread()).toBe(false);
  });

  it('does not report the main-thread runtime as Lynx, even though it also has getDevtool', () => {
    // The whole point: `lynx.getDevtool` exists in both runtimes, so it
    // cannot be what tells them apart. `@rozenite/lynx` installs its
    // dispatcher in the background runtime only.
    vi.stubGlobal('lynx', { getDevtool: () => ({}) });
    vi.stubGlobal('__BACKGROUND__', false);

    expect(isLynx()).toBe(false);
    expect(isLynxMainThread()).toBe(true);
  });

  it('reports neither on a host that is not Lynx at all', () => {
    vi.stubGlobal('__BACKGROUND__', false);

    expect(isLynx()).toBe(false);
    expect(isLynxMainThread()).toBe(false);
  });
});
