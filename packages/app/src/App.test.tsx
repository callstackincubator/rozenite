// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, type AppTarget } from './App';
import { TargetUrlError } from './connection/target-from-url';
import type { DeviceConnection, DeviceState, DeviceTarget } from './connection/device-connection';
import { getPluginBaseUrl } from './plugins';

const originalFetch = globalThis.fetch;
const originalResizeObserver = globalThis.ResizeObserver;

const CONFIG_OK = {
  installedPlugins: ['plugin-a'],
  destroyOnDetachPlugins: [],
  // No `runtimeVersion` on purpose: passing one makes `Shell` show its
  // first-run `WelcomeDialog` (unrelated to anything under test here, and
  // it renders a `ScrollArea` that jsdom can't fully back).
};

const MANIFEST_A = {
  name: 'Plugin A',
  version: '1.0.0',
  description: '',
  panels: [{ name: 'Panel 1', source: '/index.html' }],
};

beforeEach(() => {
  globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);

    if (url.endsWith(`${import.meta.env.BASE_URL}config`)) {
      return { ok: true, json: async () => CONFIG_OK } as Response;
    }
    if (url.includes(getPluginBaseUrl('plugin-a'))) {
      return { ok: true, json: async () => MANIFEST_A } as Response;
    }
    // Everything else (including the dev-mode server probe) "fails" —
    // there's no plugin dev server running in this test.
    return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;

  // jsdom doesn't implement ResizeObserver, which `@rozenite/ui`'s `Split`
  // (used inside `Shell`) needs to mount.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  globalThis.ResizeObserver = originalResizeObserver;
  vi.restoreAllMocks();
});

/** A controllable `DeviceConnection` double: `setState` drives
 * `useSyncExternalStore` the same way a real device event would. */
function createFakeConnection(
  target: DeviceTarget = { name: 'Pixel 8', appId: 'com.example.app', framework: null },
) {
  let state: DeviceState = { status: 'connecting' };
  const listeners = new Set<(state: DeviceState) => void>();
  const reconnect = vi.fn();

  const connection: DeviceConnection = {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    send: () => {},
    onMessage: () => () => {},
    getTarget: () => target,
    reconnect,
    close: () => {},
  };

  const notify = () => {
    for (const listener of listeners) {
      listener(state);
    }
  };

  return {
    connection,
    reconnect,
    setState: (next: DeviceState) => {
      state = next;
      notify();
    },
    // Mutates the target `getTarget()` returns and notifies through the
    // same `subscribe` connection.getState uses, without a status change —
    // mirrors how the real `device-connection.ts` reports a resolved
    // friendly device name (`setDeviceName`).
    setTargetName: (name: string) => {
      target = { ...target, name };
      notify();
    },
    // Same shape as `setTargetName`: how the real connection reports a
    // framework read off `ReactNativeApplication.metadataUpdated`.
    setFramework: (framework: DeviceTarget['framework']) => {
      target = { ...target, framework };
      notify();
    },
  };
}

const findPanelIframe = () =>
  waitFor(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="Plugin A: Panel 1"]');
    if (!iframe) {
      throw new Error('panel iframe not mounted');
    }
    return iframe;
  });

describe('App', () => {
  it('renders a "rozenite open" explanation for a TargetUrlError, without touching any connection', () => {
    const target: AppTarget = {
      kind: 'error',
      error: new TargetUrlError('Missing required "ws" query parameter.'),
    };

    render(<App target={target} />);

    expect(screen.getByText(/no device to connect to/i)).toBeTruthy();
    expect(screen.getByText(/rozenite open/)).toBeTruthy();
  });

  it('mounts no panels while connecting, and shows a connecting footer badge', async () => {
    const { connection } = createFakeConnection();

    render(<App target={{ kind: 'connection', connection }} />);

    expect((await screen.findAllByText('Connecting…')).length).toBeGreaterThan(0);
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('mounts the shell and shows the target name once connected', async () => {
    const { connection, setState } = createFakeConnection({
      name: 'Pixel 8',
      appId: 'com.example.app',
      framework: null,
    });
    setState({ status: 'connected' });

    render(<App target={{ kind: 'connection', connection }} />);

    await findPanelIframe();
    expect(screen.getByText('Pixel 8')).toBeTruthy();
  });

  it('names the framework in the footer once the device reports it, and not before', async () => {
    // The target is the only source: nothing is shown until the handshake
    // has produced a `ReactNativeApplication.metadataUpdated`.
    const { connection, setState, setFramework } = createFakeConnection();
    setState({ status: 'connected' });

    render(<App target={{ kind: 'connection', connection }} />);

    await findPanelIframe();
    expect(screen.queryByText('Lynx')).toBeNull();
    expect(screen.queryByText('React Native')).toBeNull();

    setFramework('Lynx');

    expect(await screen.findByText('Lynx')).toBeTruthy();
  });

  it('reflects a resolved device name even when the connection status does not change (finding 9)', async () => {
    const { connection, setState, setTargetName } = createFakeConnection({
      name: 'device-hash-abc123',
      appId: 'com.example.app',
      framework: null,
    });
    setState({ status: 'connected' });

    render(<App target={{ kind: 'connection', connection }} />);

    await findPanelIframe();
    expect(screen.getByText('device-hash-abc123')).toBeTruthy();

    // No status transition here — only the display name resolves, as
    // `device-connection.ts`'s best-effort first-attempt name lookup does.
    setTargetName('Pixel 8');

    expect(await screen.findByText('Pixel 8')).toBeTruthy();
    expect(screen.queryByText('device-hash-abc123')).toBeNull();
  });

  it('sizes Shell to share the column with the footer instead of overlaying it (finding 18)', async () => {
    const { connection, setState } = createFakeConnection();
    setState({ status: 'connected' });

    render(<App target={{ kind: 'connection', connection }} />);
    await findPanelIframe();

    // `Shell`'s root is the `PluginShell` wrapping the panel iframe.
    const shellRoot = document.querySelector('iframe')?.closest('[data-slot="plugin-shell"]');
    expect(shellRoot).toBeTruthy();
    expect(shellRoot?.className).not.toMatch(/\bh-screen\b/);
    expect(shellRoot?.className).toMatch(/\bflex-1\b/);

    // The footer is a normal flex sibling now, not fixed over the content.
    const footer = document.querySelector('footer');
    expect(footer).toBeTruthy();
    expect(footer?.className).not.toMatch(/\bfixed\b/);
  });

  it('keeps the shell and its panel iframes mounted through reloading and disconnected — the headline persistence rule', async () => {
    const { connection, setState, reconnect } = createFakeConnection();
    setState({ status: 'connected' });

    render(<App target={{ kind: 'connection', connection }} />);

    const iframe = await findPanelIframe();

    // A JS-VM reload: footer-only, no dialog, and the same iframe node stays
    // mounted (not just a same-title replacement).
    setState({ status: 'reloading' });
    expect((await screen.findAllByText('Reloading…')).length).toBeGreaterThan(0);
    expect(document.querySelector('iframe[title="Plugin A: Panel 1"]')).toBe(iframe);
    expect(screen.queryByText(/connection lost/i)).toBeNull();

    // The connection is then lost entirely: a dialog appears *over* the
    // still-mounted shell, never in its place.
    setState({ status: 'disconnected' });
    expect(await screen.findByText(/connection lost/i)).toBeTruthy();
    expect(document.querySelector('iframe[title="Plugin A: Panel 1"]')).toBe(iframe);

    screen.getByRole('button', { name: /reconnect/i }).click();
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it('shows a dev-server-unreachable dialog, over the shell, for a device-level metroUnreachable', async () => {
    const { connection, setState, reconnect } = createFakeConnection();
    setState({ status: 'connected' });

    render(<App target={{ kind: 'connection', connection }} />);
    const iframe = await findPanelIframe();

    setState({ status: 'metroUnreachable' });

    expect(await screen.findByText(/can't reach the dev server/i)).toBeTruthy();
    expect(document.querySelector('iframe[title="Plugin A: Panel 1"]')).toBe(iframe);

    screen.getByRole('button', { name: /retry/i }).click();
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it('shows a setup-guide dialog, without naming a culprit, for rozeniteMissing', async () => {
    const { connection, setState } = createFakeConnection();
    setState({ status: 'connected' });

    render(<App target={{ kind: 'connection', connection }} />);
    await findPanelIframe();

    setState({ status: 'rozeniteMissing' });

    expect(await screen.findByText(/rozenite isn't set up/i)).toBeTruthy();
    const link = screen.getByRole('link', { name: /setup guide/i });
    expect(link.getAttribute('href')).toBe('https://rozenite.dev/docs/getting-started');
  });

  it('treats a config fetch failure as metroUnreachable and offers a retry', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }) as unknown as typeof fetch;
    const { connection, setState } = createFakeConnection();
    setState({ status: 'connected' });

    render(<App target={{ kind: 'connection', connection }} />);

    expect(await screen.findByText(/can't reach the dev server/i)).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull();
  });
});
