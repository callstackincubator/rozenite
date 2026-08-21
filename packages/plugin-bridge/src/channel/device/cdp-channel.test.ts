import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DISPATCHER_KEY = '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__';
const BINDING_NAME = '__rozeniteTestBinding__';

// Simulates the dispatcher-shaped global that `@rozenite/lynx` installs on
// Lynx's background runtime (see `packages/lynx/src/dispatcher.ts`), with
// the binding already present so `getInitialCdpDomain()` resolves
// synchronously instead of waiting on `waitForDomain()`.
const stubDispatcher = () => {
  const domain = {
    name: 'rozenite',
    sendMessage: vi.fn(),
    onMessage: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    close: vi.fn(),
  };

  vi.stubGlobal(DISPATCHER_KEY, {
    BINDING_NAME,
    initializeDomain: vi.fn(() => domain),
    onDomainInitialization: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  vi.stubGlobal(BINDING_NAME, true);

  return domain;
};

describe('getCdpChannel on a simulated Lynx global', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not throw UnsupportedPlatformError and falls through to the CDP domain proxy', async () => {
    stubDispatcher();
    vi.stubGlobal('lynx', { getDevtool: () => ({}) });

    // Node's default test environment has no `window`, matching Lynx's
    // background runtime -- this is exactly what made `isServer()`
    // (`typeof window === 'undefined'`) misidentify Lynx as a server before
    // `isLynx()` was checked first.
    expect(typeof window).toBe('undefined');

    const { getCdpChannel } = await import('./cdp-channel.js');

    await expect(getCdpChannel()).resolves.toMatchObject({
      send: expect.any(Function),
      onMessage: expect.any(Function),
      close: expect.any(Function),
    });
  });

  it('still throws UnsupportedPlatformError without a lynx global (regression guard)', async () => {
    stubDispatcher();

    const { getCdpChannel } = await import('./cdp-channel.js');
    const { UnsupportedPlatformError } = await import('../../errors.js');

    await expect(getCdpChannel()).rejects.toBeInstanceOf(UnsupportedPlatformError);
  });
});
