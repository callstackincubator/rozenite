import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const GLOBAL_KEY = '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__';

// Stubs `globalThis.lynx` with a minimal `getDevtool()` implementation and
// returns the `dispatchEvent` spy so tests can assert on it.
const stubLynxWithDevtool = () => {
  const dispatchEvent = vi.fn();
  vi.stubGlobal('lynx', {
    getDevtool: () => ({
      dispatchEvent,
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  return dispatchEvent;
};

describe('Domain / FuseboxReactDevToolsDispatcher', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('__BACKGROUND__', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializeDomain returns a domain and fires onDomainInitialization', async () => {
    stubLynxWithDevtool();
    const { FuseboxReactDevToolsDispatcher } = await import('../dispatcher.js');

    const handler = vi.fn();
    FuseboxReactDevToolsDispatcher.onDomainInitialization.addEventListener(handler);

    const domain = FuseboxReactDevToolsDispatcher.initializeDomain('rozenite');

    expect(domain.name).toBe('rozenite');
    expect(handler).toHaveBeenCalledWith(domain);
  });

  it('domain.sendMessage dispatches through lynx.getDevtool with the byte-identical payload shape', async () => {
    const dispatchEvent = stubLynxWithDevtool();
    const { FuseboxReactDevToolsDispatcher } = await import('../dispatcher.js');

    const domain = FuseboxReactDevToolsDispatcher.initializeDomain('rozenite');
    const message = { event: 'my-event', payload: { foo: 'bar' } };
    domain.sendMessage(message);

    expect(dispatchEvent).toHaveBeenCalledWith({
      type: 'rozenite',
      data: JSON.stringify({ domain: 'rozenite', message }),
    });
  });

  it('static sendMessage emits the parsed object to onMessage listeners (host -> device path)', async () => {
    stubLynxWithDevtool();
    const { FuseboxReactDevToolsDispatcher } = await import('../dispatcher.js');

    const domain = FuseboxReactDevToolsDispatcher.initializeDomain('rozenite');
    const listener = vi.fn();
    domain.onMessage.addEventListener(listener);

    const payload = { event: 'incoming', payload: { hello: 'world' } };
    FuseboxReactDevToolsDispatcher.sendMessage('rozenite', JSON.stringify(payload));

    expect(listener).toHaveBeenCalledWith(payload);
  });

  it('static sendMessage to an uninitialized domain throws', async () => {
    stubLynxWithDevtool();
    const { FuseboxReactDevToolsDispatcher } = await import('../dispatcher.js');

    expect(() => FuseboxReactDevToolsDispatcher.sendMessage('rozenite', '{}')).toThrow(
      "Could not send message to rozenite: domain doesn't exist",
    );
  });

  it('static sendMessage catches and logs malformed JSON instead of throwing', async () => {
    stubLynxWithDevtool();
    const { FuseboxReactDevToolsDispatcher } = await import('../dispatcher.js');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    FuseboxReactDevToolsDispatcher.initializeDomain('rozenite');

    expect(() =>
      FuseboxReactDevToolsDispatcher.sendMessage('rozenite', '{not valid json'),
    ).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('initializeDomain throws a helpful error when lynx.getDevtool is missing', async () => {
    // No `lynx` stub at all this time.
    const { FuseboxReactDevToolsDispatcher } = await import('../dispatcher.js');

    expect(() => FuseboxReactDevToolsDispatcher.initializeDomain('rozenite')).toThrow(
      /lynx\.getDevtool/,
    );
  });
});

// Kept separate from the suite above, and ordered so the "not installed"
// case runs before anything installs the global: `setupRozenite` defines
// `globalThis.__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__` as non-configurable, so
// once any test in this file installs it for real there is no way to remove
// it again for a later test.
describe('setupRozenite (module install)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not install the global when __BACKGROUND__ is false', async () => {
    vi.stubGlobal('__BACKGROUND__', false);
    stubLynxWithDevtool();

    await import('../index.js');

    expect((globalThis as Record<string, unknown>)[GLOBAL_KEY]).toBeUndefined();
  });

  it('installing defines globalThis.__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__, and a second install does not throw', async () => {
    vi.stubGlobal('__BACKGROUND__', true);
    stubLynxWithDevtool();

    const { setupRozenite } = await import('../install.js');

    setupRozenite();
    expect((globalThis as Record<string, unknown>)[GLOBAL_KEY]).toBeDefined();

    expect(() => setupRozenite()).not.toThrow();
  });
});
