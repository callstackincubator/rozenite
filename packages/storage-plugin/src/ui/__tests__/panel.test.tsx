// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageDescriptor, StorageTarget } from '../../shared/types';
import type { StorageEventMap } from '../../shared/messaging';

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

    return { remove: () => typeListeners.delete(listener) };
  });

  return {
    client: { send, onMessage },
    selectChange: undefined as ((value: unknown) => void) | undefined,
    emit: (type: keyof StorageEventMap, payload: unknown) => {
      listeners.get(type)?.forEach((listener) => listener(payload));
    },
    reset: () => {
      listeners.clear();
      send.mockReset();
      onMessage.mockClear();
      mocks.selectChange = undefined;
    },
  };
});

vi.mock('@rozenite/plugin-bridge', () => ({
  useRozeniteDevToolsClient: () => mocks.client,
}));

vi.mock('@rozenite/ui', async () => {
  const React = await import('react');
  const PassThrough = ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  );
  const Select = Object.assign(
    ({
      children,
      onChange,
    }: {
      children?: ReactNode;
      onChange: (value: unknown) => void;
    }) => {
      mocks.selectChange = onChange;
      return <>{children}</>;
    },
    {
      Trigger: PassThrough,
      Value: PassThrough,
      Indicator: PassThrough,
      Popover: PassThrough,
    }
  );
  const ListBox = Object.assign(PassThrough, {
    Item: PassThrough,
    ItemIndicator: PassThrough,
  });
  const SearchField = Object.assign(PassThrough, {
    Group: PassThrough,
    SearchIcon: PassThrough,
    Input: () => null,
    ClearButton: PassThrough,
  });

  return {
    ConfirmDialog: () => null,
    EditableTable: () => <div />,
    EntryDetailDialog: () => null,
    ListBox,
    PluginHeader: ({ actions }: { actions?: ReactNode }) => <>{actions}</>,
    PluginTheme: PassThrough,
    SearchField,
    Select,
  };
});

vi.mock('../add-entry-dialog', () => ({ AddEntryDialog: () => null }));
vi.mock('../edit-entry-dialog', () => ({ EditEntryDialog: () => null }));
vi.mock('../import-dialog', () => ({ ImportDialog: () => null }));
vi.mock('../entry-value', () => ({
  renderDetailValue: vi.fn(),
  renderTableValue: vi.fn(),
}));

import StoragePanel from '../panel';

const firstTarget: StorageTarget = { adapterId: 'mmkv', storageId: 'first' };
const secondTarget: StorageTarget = { adapterId: 'async', storageId: 'second' };

const descriptors: StorageDescriptor[] = [
  {
    target: firstTarget,
    adapterName: 'MMKV',
    storageName: 'First',
    capabilities: { supportedTypes: ['string'] },
    supportsSubscriptions: true,
  },
  {
    target: secondTarget,
    adapterName: 'AsyncStorage',
    storageName: 'Second',
    capabilities: { supportedTypes: ['string'] },
    supportsSubscriptions: false,
  },
];

const renderPanel = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<StoragePanel />);
  });

  return { root, container };
};

const unmountPanel = async (root: Root, container: HTMLDivElement) => {
  await act(async () => root.unmount());
  container.remove();
};

const emittedDiscoveryRequest = () =>
  mocks.client.send.mock.calls.find(
    ([type]) => type === 'discover-storages'
  )?.[1] as StorageEventMap['discover-storages'];

const snapshotTargets = () =>
  mocks.client.send.mock.calls
    .filter(([type]) => type === 'get-snapshot')
    .map(([, event]) => (event as StorageEventMap['get-snapshot']).target);

describe('StoragePanel discovery migration', () => {
  beforeEach(() => {
    mocks.reset();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('discovers storages before requesting the first selected snapshot', async () => {
    const { root, container } = await renderPanel();

    const request = emittedDiscoveryRequest();
    expect(request).toMatchObject({ type: 'discover-storages' });
    expect(snapshotTargets()).toEqual([]);

    await act(async () => {
      mocks.emit('storage-descriptors', {
        type: 'storage-descriptors',
        requestId: request.requestId,
        storages: descriptors,
      });
    });

    expect(snapshotTargets()).toEqual([firstTarget]);
    await unmountPanel(root, container);
  });

  it('reads only the newly selected storage and refreshes that storage', async () => {
    const { root, container } = await renderPanel();
    const request = emittedDiscoveryRequest();

    await act(async () => {
      mocks.emit('storage-descriptors', {
        type: 'storage-descriptors',
        requestId: request.requestId,
        storages: descriptors,
      });
    });
    expect(snapshotTargets()).toEqual([firstTarget]);

    await act(async () => mocks.selectChange?.('async:second'));
    expect(snapshotTargets()).toEqual([firstTarget, secondTarget]);

    await act(async () => {
      mocks.emit('snapshot', {
        type: 'snapshot',
        target: secondTarget,
        adapterName: 'AsyncStorage',
        storageName: 'Second',
        capabilities: { supportedTypes: ['string'] },
        entries: [],
      });
    });

    const refresh = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Refresh')
    );
    expect(refresh).toBeDefined();
    await act(async () => refresh?.click());

    expect(snapshotTargets()).toEqual([
      firstTarget,
      secondTarget,
      secondTarget,
    ]);
    await unmountPanel(root, container);
  });
});
