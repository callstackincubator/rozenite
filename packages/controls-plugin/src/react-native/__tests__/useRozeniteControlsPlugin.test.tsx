// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSection } from '../../shared/types';
import type { ControlsEventMap } from '../../shared/messaging';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

type Listener = (payload: unknown) => void;

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, Set<Listener>>();
  const send = vi.fn();
  const onMessage = vi.fn((type: string, listener: Listener) => {
    const typeListeners = listeners.get(type) ?? new Set<Listener>();
    typeListeners.add(listener);
    listeners.set(type, typeListeners);

    return {
      remove: () => {
        typeListeners.delete(listener);
      },
    };
  });

  return {
    client: {
      send,
      onMessage,
    },
    emit: (type: keyof ControlsEventMap, payload: unknown) => {
      listeners.get(type)?.forEach((listener) => {
        listener(payload);
      });
    },
    reset: () => {
      listeners.clear();
      send.mockReset();
      onMessage.mockClear();
    },
  };
});

vi.mock('@rozenite/plugin-bridge', () => ({
  useRozeniteDevToolsClient: () => mocks.client,
}));

vi.mock('../useControlsAgentTools', () => ({
  useControlsAgentTools: vi.fn(),
}));

import { useRozeniteControlsPlugin } from '../useRozeniteControlsPlugin';

const appSection = createSection({
  id: 'app',
  title: 'App',
  items: [],
});

const localeSection = (onUpdate: (value: string) => void = vi.fn()) =>
  createSection({
    id: 'locale',
    title: 'Locale',
    items: [
      {
        id: 'language',
        type: 'select',
        title: 'Language',
        value: 'en',
        options: [
          { label: 'English', value: 'en' },
          { label: 'Polish', value: 'pl' },
        ],
        onUpdate,
      },
    ],
  });

function AppControls() {
  useRozeniteControlsPlugin({
    sections: [appSection],
  });

  return null;
}

function LocaleControls({
  onUpdate = vi.fn(),
}: {
  onUpdate?: (value: string) => void;
}) {
  useRozeniteControlsPlugin((previousOptions) => ({
    sections: [...previousOptions.sections, localeSection(onUpdate)],
  }));

  return null;
}

function TestApp({
  showLocale = true,
  onUpdate,
}: {
  showLocale?: boolean;
  onUpdate?: (value: string) => void;
}) {
  return (
    <>
      <AppControls />
      {showLocale ? <LocaleControls onUpdate={onUpdate} /> : null}
    </>
  );
}

const renderControls = async (
  element: ReactNode,
): Promise<{
  root: Root;
  container: HTMLDivElement;
}> => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(element);
  });

  return { root, container };
};

const unmountControls = async (root: Root, container: HTMLDivElement) => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
};

const getLastSnapshotSectionIds = () => {
  const snapshots = mocks.client.send.mock.calls.filter(
    ([type]) => type === 'snapshot',
  );
  const lastSnapshot = snapshots.at(-1)?.[1] as
    | ControlsEventMap['snapshot']
    | undefined;

  return lastSnapshot?.sections.map((section) => section.id);
};

describe('useRozeniteControlsPlugin', () => {
  beforeEach(() => {
    mocks.reset();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('publishes a combined snapshot from multiple hook instances', async () => {
    const { root, container } = await renderControls(<TestApp />);

    expect(getLastSnapshotSectionIds()).toEqual(['app', 'locale']);

    await unmountControls(root, container);
  });

  it('removes sections when their hook instance unmounts', async () => {
    const { root, container } = await renderControls(<TestApp />);

    await act(async () => {
      root.render(<TestApp showLocale={false} />);
    });

    expect(getLastSnapshotSectionIds()).toEqual(['app']);

    await unmountControls(root, container);
  });

  it('routes updates to sections registered by another hook instance', async () => {
    const onUpdate = vi.fn();
    const { root, container } = await renderControls(
      <TestApp onUpdate={onUpdate} />,
    );

    await act(async () => {
      mocks.emit('update-request', {
        type: 'update-request',
        requestId: 'request-1',
        sectionId: 'locale',
        itemId: 'language',
        value: 'pl',
      });
    });

    expect(onUpdate).toHaveBeenCalledWith('pl');
    expect(mocks.client.send).toHaveBeenCalledWith('update-result', {
      type: 'update-result',
      requestId: 'request-1',
      sectionId: 'locale',
      itemId: 'language',
      status: 'ok',
    });

    await unmountControls(root, container);
  });
});
