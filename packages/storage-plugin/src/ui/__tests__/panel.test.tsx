// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageEventMap } from '../../shared/messaging';
import type { StorageDescriptor, StorageTarget } from '../../shared/types';

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean | undefined; }
type Listener = (payload: unknown) => void;

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, Set<Listener>>();
  const send = vi.fn();
  const request = vi.fn();
  const onMessage = vi.fn((type: string, listener: Listener) => {
    const typeListeners = listeners.get(type) ?? new Set<Listener>();
    typeListeners.add(listener);
    listeners.set(type, typeListeners);
    return { remove: () => typeListeners.delete(listener) };
  });
  return { client: { send, onMessage, request }, emit: (type: keyof StorageEventMap, payload: unknown) => listeners.get(type)?.forEach((listener) => listener(payload)), reset: () => { listeners.clear(); send.mockReset(); request.mockReset(); onMessage.mockClear(); } };
});

vi.mock('@rozenite/plugin-bridge', () => ({ useRozeniteDevToolsClient: () => mocks.client }));
vi.mock('@rozenite/ui', async () => {
  const React = await import('react');
  const PassThrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const PluginShell = Object.assign(PassThrough, { Body: PassThrough });
  const Split = Object.assign(PassThrough, { Pane: PassThrough, Handle: PassThrough });
  const Sidebar = Object.assign(PassThrough, { Group: PassThrough, Item: ({ children, onClick }: { children?: ReactNode; onClick: () => void }) => <button onClick={onClick}>{children}</button> });
  const Toolbar = Object.assign(PassThrough, { Group: PassThrough, Separator: PassThrough, Button: ({ children, onClick, disabled }: { children?: ReactNode; onClick: () => void; disabled?: boolean }) => <button onClick={onClick} disabled={disabled}>{children}</button> });
  return { Badge: PassThrough, Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>, ConfirmDialog: () => null, EmptyState: () => <div />, PluginShell, SearchField: ({ value, onChange }: { value: string; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void }) => <input value={value} onChange={onChange} />, Sidebar, Split, Toolbar, VirtualizedDataTable: ({ data, onEndReached, onRowClick }: { data: { key: string }[]; onEndReached?: () => void; onRowClick?: (entry: { key: string }) => void }) => <div><button onClick={onEndReached}>reach end</button>{data.map((entry) => <button key={entry.key} onClick={() => onRowClick?.(entry)}>{entry.key}</button>)}</div> };
});
vi.mock('../add-entry-dialog', () => ({ AddEntryDialog: () => null }));
vi.mock('../edit-entry-dialog', () => ({ EditEntryDialog: () => null }));
vi.mock('../entry-detail-dialog', () => ({ EntryDetailDialog: () => null }));
vi.mock('../import-dialog', () => ({ ImportDialog: () => null }));
vi.mock('../utils', () => ({ buildExportFilename: vi.fn(() => 'snapshot.json'), downloadJson: vi.fn() }));

import StoragePanel from '../panel';

const target: StorageTarget = { adapterId: 'mmkv', storageId: 'first' };
const descriptors: StorageDescriptor[] = [{ target, adapterName: 'MMKV', storageName: 'First', capabilities: { supportedTypes: ['string'] }, supportsSubscriptions: true }];
const previewResponse = (cursor?: string) => ({ type: 'entry-previews' as const, requestId: `page-${cursor ?? 'first'}`, target, items: [{ key: cursor ?? 'first', type: 'string' as const, preview: cursor ?? 'first', valueSize: 5, isTruncated: false }], nextCursor: cursor ? undefined : 'next' });
const renderPanel = async () => { const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); await act(async () => root.render(<StoragePanel />)); return { root, container }; };
const discover = async () => { const request = mocks.client.send.mock.calls.find(([type]) => type === 'discover-storages')?.[1]; await act(async () => mocks.emit('storage-descriptors', { type: 'storage-descriptors', requestId: request.requestId, storages: descriptors })); };

describe('StoragePanel preview query cutover', () => {
  beforeEach(() => { mocks.reset(); globalThis.IS_REACT_ACT_ENVIRONMENT = true; mocks.client.request.mockImplementation(({ payload }: { payload: { type: string; cursor?: string; key?: string } }) => { if (payload.type === 'list-entry-previews') return Promise.resolve(previewResponse(payload.cursor)); if (payload.type === 'get-entry') return Promise.resolve({ type: 'entry', requestId: 'full-1', target, entry: { key: payload.key, type: 'string', value: 'full value' } }); return Promise.resolve({ type: 'export-snapshot-result', requestId: 'export-1', target, snapshot: {} }); }); });
  afterEach(() => { document.body.innerHTML = ''; delete globalThis.IS_REACT_ACT_ENVIRONMENT; vi.useRealTimers(); });

  it('loads bounded preview pages and guards duplicate edge fetches', async () => {
    const { root, container } = await renderPanel(); await discover();
    await vi.waitFor(() => expect(mocks.client.request).toHaveBeenCalledTimes(1));
    await act(async () => { const edge = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'reach end'); edge?.click(); edge?.click(); });
    await vi.waitFor(() => expect(mocks.client.request).toHaveBeenCalledTimes(2));
    expect(mocks.client.request.mock.calls.map(([options]) => options.payload.cursor)).toEqual([undefined, 'next']);
    await act(async () => root.unmount());
  });

  it('debounces search into a new device-owned query sequence', async () => {
    vi.useFakeTimers(); const { root, container } = await renderPanel(); await discover();
    await vi.waitFor(() => expect(mocks.client.request).toHaveBeenCalledTimes(1));
    await act(async () => { const input = container.querySelector('input'); if (input) { input.value = '  Needle  '; input.dispatchEvent(new Event('input', { bubbles: true })); } vi.advanceTimersByTime(250); });
    await vi.waitFor(() => expect(mocks.client.request).toHaveBeenCalledTimes(2));
    expect(mocks.client.request.mock.calls[1][0].payload).toMatchObject({ cursor: undefined, search: 'needle' });
    await act(async () => root.unmount());
  });

  it('fetches a full value only when a preview row opens details', async () => {
    const { root, container } = await renderPanel(); await discover();
    await vi.waitFor(() => expect(container.textContent).toContain('first'));
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'first')?.click());
    await vi.waitFor(() => expect(mocks.client.request.mock.calls[1][0].payload).toMatchObject({ type: 'get-entry', key: 'first' }));
    await act(async () => root.unmount());
  });

  it('refreshes from the first page without changing the query', async () => {
    const { root, container } = await renderPanel(); await discover();
    await vi.waitFor(() => expect(mocks.client.request).toHaveBeenCalledTimes(1));
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Refresh'))?.click());
    await vi.waitFor(() => expect(mocks.client.request).toHaveBeenCalledTimes(2));
    expect(mocks.client.request.mock.calls[1][0].payload.cursor).toBeUndefined();
    await act(async () => root.unmount());
  });
});
