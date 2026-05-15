// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRozeniteTestHarness,
  RozeniteDevToolsTestProvider,
} from './index.js';
import { useRozeniteDevToolsClient } from './useRozeniteDevToolsClient.js';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const mocks = vi.hoisted(() => {
  const send = vi.fn();
  const onMessage = vi.fn(() => ({
    remove: vi.fn(),
  }));
  const close = vi.fn();
  const getRozeniteDevToolsClient = vi.fn(async () => ({
    send,
    onMessage,
    close,
  }));

  return {
    send,
    onMessage,
    close,
    getRozeniteDevToolsClient,
    reset: () => {
      send.mockReset();
      onMessage.mockClear();
      close.mockReset();
      getRozeniteDevToolsClient.mockClear();
    },
  };
});

vi.mock('./client', () => ({
  getRozeniteDevToolsClient: mocks.getRozeniteDevToolsClient,
}));

function TestComponent() {
  useRozeniteDevToolsClient({
    pluginId: '@rozenite/storage-plugin',
  });

  return null;
}

function ObservedComponent({
  onClientChange,
}: {
  onClientChange: (client: ReturnType<typeof useRozeniteDevToolsClient>) => void;
}) {
  const client = useRozeniteDevToolsClient({
    pluginId: '@rozenite/storage-plugin',
  });

  onClientChange(client);

  return null;
}

const renderHook = async (element: ReactNode = <TestComponent />): Promise<{
  root: Root;
  container: HTMLDivElement;
}> => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(element);
  });

  await act(async () => {
    await Promise.resolve();
  });

  return { root, container };
};

const unmountHook = async (root: Root, container: HTMLDivElement) => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
};

describe('useRozeniteDevToolsClient', () => {
  beforeEach(() => {
    mocks.reset();
    vi.useFakeTimers();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    Reflect.deleteProperty(globalThis, '__ROZENITE_PANEL__');
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    Reflect.deleteProperty(globalThis, '__ROZENITE_PANEL__');
  });

  it('sends plugin-mounted after the device client becomes available', async () => {
    const { root, container } = await renderHook();

    expect(mocks.getRozeniteDevToolsClient).toHaveBeenCalledWith(
      '@rozenite/storage-plugin',
    );
    expect(mocks.send).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mocks.send).toHaveBeenCalledWith('plugin-mounted', {
      pluginId: '@rozenite/storage-plugin',
    });

    await unmountHook(root, container);
  });

  it('does not send plugin-mounted from panel clients', async () => {
    globalThis.__ROZENITE_PANEL__ = true;
    const { root, container } = await renderHook();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mocks.send).not.toHaveBeenCalled();

    await unmountHook(root, container);
  });

  it('uses the test harness when wrapped in the test provider', async () => {
    const harness = createRozeniteTestHarness<{
      'plugin-mounted': { pluginId: string };
      init: { ready: boolean };
    }>();
    const seenClients: Array<ReturnType<typeof useRozeniteDevToolsClient>> = [];

    const { root, container } = await renderHook(
      <RozeniteDevToolsTestProvider harness={harness}>
        <ObservedComponent
          onClientChange={(client) => {
            seenClients.push(client);
          }}
        />
      </RozeniteDevToolsTestProvider>,
    );

    expect(mocks.getRozeniteDevToolsClient).not.toHaveBeenCalled();
    expect(seenClients.at(-1)).toBeNull();
    expect(harness.isConnected('@rozenite/storage-plugin')).toBe(false);

    await act(async () => {
      harness.connect('@rozenite/storage-plugin');
    });

    expect(seenClients.at(-1)).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(harness.getSent('@rozenite/storage-plugin')).toContainEqual({
      pluginId: '@rozenite/storage-plugin',
      type: 'plugin-mounted',
      payload: {
        pluginId: '@rozenite/storage-plugin',
      },
    });

    await act(async () => {
      harness.disconnect('@rozenite/storage-plugin');
    });

    expect(seenClients.at(-1)).toBeNull();

    await unmountHook(root, container);
  });
});
