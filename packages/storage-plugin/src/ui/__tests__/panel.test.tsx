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
  const request = vi.fn();
  const downloadJson = vi.fn();
  const onMessage = vi.fn((type: string, listener: Listener) => {
    const typeListeners = listeners.get(type) ?? new Set<Listener>();
    typeListeners.add(listener);
    listeners.set(type, typeListeners);

    return { remove: () => typeListeners.delete(listener) };
  });

  return {
    client: { send, onMessage, request },
    downloadJson,
    emit: (type: keyof StorageEventMap, payload: unknown) => {
      listeners.get(type)?.forEach((listener) => listener(payload));
    },
    reset: () => {
      listeners.clear();
      send.mockReset();
      request.mockReset();
      downloadJson.mockReset();
      onMessage.mockClear();
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
  const SearchField = Object.assign(PassThrough, {
    Group: PassThrough,
  });
  const PluginShell = Object.assign(PassThrough, {
    Body: PassThrough,
  });
  const Split = Object.assign(PassThrough, {
    Pane: PassThrough,
    Handle: PassThrough,
  });
  const Sidebar = Object.assign(PassThrough, {
    Group: PassThrough,
    Item: ({ children, onClick }: { children?: ReactNode; onClick: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
  });
  const Toolbar = Object.assign(PassThrough, {
    Group: PassThrough,
    Separator: PassThrough,
    Button: ({
      children,
      onClick,
      disabled,
    }: {
      children?: ReactNode;
      onClick: () => void;
      disabled?: boolean;
    }) => (
      <button onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
  });

  return {
    Badge: PassThrough,
    Button: PassThrough,
    ConfirmDialog: () => null,
    DataTable: () => <div />,
    DataTableEditableCell: () => null,
    EmptyState: () => <div />,
    PluginShell,
    SearchField,
    Sidebar,
    Split,
    Toolbar,
  };
});

vi.mock('../add-entry-dialog', () => ({ AddEntryDialog: () => null }));
vi.mock('../edit-entry-dialog', () => ({ EditEntryDialog: () => null }));
vi.mock('../import-dialog', () => ({ ImportDialog: () => null }));
vi.mock('../entry-detail-dialog', () => ({ EntryDetailDialog: () => null }));
vi.mock('../utils', () => ({
  buildExportFilename: vi.fn(() => 'snapshot.json'),
  downloadJson: mocks.downloadJson,
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
    ([type]) => type === 'discover-storages',
  )?.[1] as StorageEventMap['discover-storages'];

const snapshotTargets = () =>
  mocks.client.send.mock.calls
    .filter(([type]) => type === 'get-snapshot')
    .map(([, event]) => (event as StorageEventMap['get-snapshot']).target);

const exportButton = (container: HTMLDivElement) =>
  Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Export'),
  );

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

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Second'))
        ?.click();
    });
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
      (button) => button.textContent?.includes('Refresh'),
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

  it('exports the complete device snapshot only after Export is pressed, including an empty storage', async () => {
    mocks.client.request.mockResolvedValue({
      type: 'export-snapshot-result',
      requestId: 'export-1',
      target: firstTarget,
      snapshot: {
        version: 1,
        plugin: '@rozenite/storage-plugin',
        createdAt: '2026-01-01T00:00:00.000Z',
        storage: {
          adapterId: firstTarget.adapterId,
          storageId: firstTarget.storageId,
          adapterName: 'MMKV',
          storageName: 'First',
          capabilities: { supportedTypes: ['string'] },
        },
        entries: [],
      },
    });
    const { root, container } = await renderPanel();
    const discovery = emittedDiscoveryRequest();
    await act(async () => {
      mocks.emit('storage-descriptors', {
        type: 'storage-descriptors',
        requestId: discovery.requestId,
        storages: descriptors,
      });
    });

    expect(mocks.client.request).not.toHaveBeenCalled();
    await act(async () => exportButton(container)?.click());

    expect(mocks.client.request).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'export-snapshot',
        responseType: 'export-snapshot-result',
        errorType: 'storage-request-error',
        payload: { type: 'export-snapshot', target: firstTarget },
      }),
    );
    expect(mocks.downloadJson).toHaveBeenCalledTimes(1);
    await unmountPanel(root, container);
  });

  it('cancels export on target switch and ignores its stale response', async () => {
    let resolveExport: ((value: unknown) => void) | undefined;
    mocks.client.request.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExport = resolve;
        }),
    );
    const { root, container } = await renderPanel();
    const discovery = emittedDiscoveryRequest();
    await act(async () => {
      mocks.emit('storage-descriptors', {
        type: 'storage-descriptors',
        requestId: discovery.requestId,
        storages: descriptors,
      });
      exportButton(container)?.click();
    });

    const options = mocks.client.request.mock.calls[0][0];
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Second'))
        ?.click();
    });
    expect(options.signal.aborted).toBe(true);

    await act(async () => {
      resolveExport?.({ snapshot: {}, target: firstTarget });
    });
    expect(container.textContent).not.toContain('Could not export');
    await unmountPanel(root, container);
  });

  it('shows an export failure and clears its loading state', async () => {
    mocks.client.request.mockRejectedValue(new Error('device failed'));
    const { root, container } = await renderPanel();
    const discovery = emittedDiscoveryRequest();
    await act(async () => {
      mocks.emit('storage-descriptors', {
        type: 'storage-descriptors',
        requestId: discovery.requestId,
        storages: descriptors,
      });
      exportButton(container)?.click();
    });

    expect(container.textContent).toContain(
      'Could not export the selected storage. Please try again.',
    );
    expect(exportButton(container)?.textContent).toContain('Export');
    await unmountPanel(root, container);
  });
});
