// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const renderHook = async (): Promise<{
  root: Root;
  container: HTMLDivElement;
}> => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<TestComponent />);
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
});
