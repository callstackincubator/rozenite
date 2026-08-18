import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef, OnChangeFn, SortingState } from '@tanstack/react-table';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  IconButton,
  PluginShell,
  SearchField,
  Sidebar,
  Split,
  Toolbar,
  VirtualizedDataTable,
} from '@rozenite/ui';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Database, Download, Edit3, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import type {
  StorageDiscoverStoragesResponseEvent,
  StorageEventMap,
  StorageImportProgressEvent,
  StorageImportResultEvent,
  StorageInvalidatedEvent,
} from '../shared/messaging';
import { parseSnapshot } from '../shared/snapshot';
import type {
  StorageDescriptor,
  StorageEntry,
  StorageEntryPreview,
  StorageEntryValue,
  StorageTarget,
} from '../shared/types';
import { getStorageViewId } from '../shared/types';
import { AddEntryDialog } from './add-entry-dialog';
import { EditEntryDialog } from './edit-entry-dialog';
import { EntryDetailDialog } from './entry-detail-dialog';
import { ImportDialog, type ImportFlightState } from './import-dialog';
import { StorageQueryClientProvider } from './query-client';
import { buildStorageSidebarGroups } from './storage-groups';
import {
  flattenStorageEntryPreviewPages,
  dropStorageFullEntries,
  invalidateStorageEntryPreviews,
  resetSelectedStorageQueries,
  useStorageEntryPreviews,
  useStorageFullEntry,
} from './use-storage-entries';
import { buildExportFilename, downloadJson } from './utils';
import './globals.css';

type AlertState = { title: string; message: string };
type FullEntryInteraction = { key: string; mode: 'detail' | 'edit' };

const sameTarget = (a: StorageTarget, b: StorageTarget) =>
  a.adapterId === b.adapterId && a.storageId === b.storageId;

const getEntryTypeFromValue = (value: StorageEntryValue): StorageEntry['type'] => {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'buffer';
};

const useDebouncedValue = (value: string, delay = 250) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
};

function StoragePanelContent() {
  const [descriptors, setDescriptors] = useState<StorageDescriptor[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<StorageTarget | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [keySortDirection, setKeySortDirection] = useState<'ascending' | 'descending'>('ascending');
  const [interaction, setInteraction] = useState<FullEntryInteraction | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [virtualListVersion, setVirtualListVersion] = useState(0);
  const [exportState, setExportState] = useState<
    { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string }
  >({ status: 'idle' });
  const [importFlight, setImportFlight] = useState<ImportFlightState | null>(null);
  const [alertState, setAlertState] = useState<AlertState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedTargetRef = useRef<StorageTarget | null>(null);
  const discoveryRequestIdRef = useRef(0);
  const exportAbortControllerRef = useRef<AbortController | null>(null);
  const importPreviewAbortControllerRef = useRef<AbortController | null>(null);
  const importRequestIdRef = useRef(0);
  const activeImportRequestIdRef = useRef<string | null>(null);
  const isFetchingNextPageRef = useRef(false);
  const isFetchingPreviousPageRef = useRef(false);
  const pendingInvalidationsRef = useRef(new Set<string>());
  const client = useRozeniteDevToolsClient<StorageEventMap>({
    pluginId: '@rozenite/storage-plugin',
  });
  const queryClient = useQueryClient();
  const debouncedSearch = useDebouncedValue(searchTerm);
  const selectedDescriptor = descriptors.find(
    (descriptor) => selectedTarget && sameTarget(descriptor.target, selectedTarget),
  );
  const previews = useStorageEntryPreviews({
    client,
    target: selectedTarget,
    search: debouncedSearch,
    keySortDirection,
  });
  const fullEntry = useStorageFullEntry({
    client,
    target: selectedTarget,
    key: interaction?.key,
    enabled: interaction !== null,
  });
  const rows = flattenStorageEntryPreviewPages(previews.data);
  const supportedTypes = selectedDescriptor?.capabilities.supportedTypes ?? [];
  const sidebarGroups = useMemo(() => {
    const storages = new Map(
      descriptors.map((descriptor) => [getStorageViewId(descriptor.target), descriptor]),
    );
    return buildStorageSidebarGroups(storages);
  }, [descriptors]);

  const closeInteraction = () => {
    fullEntry.reset();
    setInteraction(null);
  };

  const refreshSelectedStorage = async () => {
    if (!selectedTarget) return;
    closeInteraction();
    setVirtualListVersion((version) => version + 1);
    await resetSelectedStorageQueries(queryClient, selectedTarget);
  };

  useEffect(() => {
    if (!client) return;

    const requestDiscovery = () => {
      discoveryRequestIdRef.current += 1;
      client.send('discover-storages', {
        type: 'discover-storages',
        requestId: `discovery-${discoveryRequestIdRef.current}`,
      });
    };

    const descriptorsSubscription = client.onMessage(
      'storage-descriptors',
      (event: StorageDiscoverStoragesResponseEvent) => {
        if (event.requestId !== `discovery-${discoveryRequestIdRef.current}`) return;
        setDescriptors(event.storages);
        setSelectedTarget((previous) =>
          previous && event.storages.some((descriptor) => sameTarget(descriptor.target, previous))
            ? previous
            : (event.storages[0]?.target ?? null),
        );
      },
    );
    const importProgressSubscription = client.onMessage(
      'import-progress',
      (event: StorageImportProgressEvent) => {
        setImportFlight((previous) =>
          previous?.phase === 'importing' &&
          previous.requestId === event.requestId &&
          sameTarget(previous.target, event.target)
            ? { ...previous, written: event.written, total: event.total }
            : previous,
        );
      },
    );
    const importResultSubscription = client.onMessage(
      'import-result',
      (event: StorageImportResultEvent) => {
        if (
          activeImportRequestIdRef.current === event.requestId &&
          selectedTargetRef.current &&
          sameTarget(event.target, selectedTargetRef.current)
        ) {
          activeImportRequestIdRef.current = null;
          closeInteraction();
          setVirtualListVersion((version) => version + 1);
          void resetSelectedStorageQueries(queryClient, event.target);
        }
        setImportFlight((previous) => {
          if (
            previous?.phase !== 'importing' ||
            previous.requestId !== event.requestId ||
            !sameTarget(previous.target, event.target)
          )
            return previous;
          return event.ok
            ? { phase: 'result', ok: true, written: event.written }
            : {
                phase: 'result',
                ok: false,
                written: event.written,
                total: event.total,
                failedKey: event.failedKey,
                error: event.error ?? 'Unknown error',
              };
        });
      },
    );
    const invalidationSubscription = client.onMessage(
      'storage-invalidated',
      (event: StorageInvalidatedEvent) => {
        void dropStorageFullEntries(queryClient, event.target, event.key);
        setDescriptors((current) =>
          current.map((descriptor) =>
            sameTarget(descriptor.target, event.target)
              ? { ...descriptor, entryCount: event.entryCount }
              : descriptor,
          ),
        );
        if (selectedTargetRef.current && sameTarget(event.target, selectedTargetRef.current)) {
          setInteraction((current) =>
            current && (event.key == null || current.key === event.key) ? null : current,
          );
        }

        const targetId = getStorageViewId(event.target);
        if (pendingInvalidationsRef.current.has(targetId)) return;
        pendingInvalidationsRef.current.add(targetId);
        queueMicrotask(() => {
          pendingInvalidationsRef.current.delete(targetId);
          if (selectedTargetRef.current && sameTarget(event.target, selectedTargetRef.current)) {
            setVirtualListVersion((version) => version + 1);
          }
          void invalidateStorageEntryPreviews(queryClient, event.target);
        });
      },
    );

    // The device announces itself once it is listening. It reconnects on every
    // app reload, so discovery has to run again — the descriptors and cached
    // entries the panel holds belong to the previous JS context.
    const deviceReadySubscription = client.onMessage('device-ready', () => {
      void queryClient.resetQueries();
      requestDiscovery();
    });

    requestDiscovery();
    return () => {
      descriptorsSubscription.remove();
      importProgressSubscription.remove();
      importResultSubscription.remove();
      invalidationSubscription.remove();
      deviceReadySubscription.remove();
    };
  }, [client, queryClient]);

  useEffect(() => {
    selectedTargetRef.current = selectedTarget;
    exportAbortControllerRef.current?.abort();
    exportAbortControllerRef.current = null;
    importPreviewAbortControllerRef.current?.abort();
    importPreviewAbortControllerRef.current = null;
    activeImportRequestIdRef.current = null;
    setExportState({ status: 'idle' });
    setDeleteKey(null);
    setShowPurgeDialog(false);
    setInteraction(null);
    setImportFlight(null);
  }, [selectedTarget]);

  useEffect(
    () => () => {
      exportAbortControllerRef.current?.abort();
      importPreviewAbortControllerRef.current?.abort();
    },
    [],
  );

  const mutateSelectedStorage = (operation: () => void) => {
    operation();
  };

  const handleValueChange = (key: string, newValue: StorageEntryValue) => {
    if (!client || !selectedTarget || !supportedTypes.includes(getEntryTypeFromValue(newValue)))
      return;
    const type = getEntryTypeFromValue(newValue);
    const entry =
      type === 'string'
        ? { key, type, value: newValue as string }
        : type === 'number'
          ? { key, type, value: newValue as number }
          : type === 'boolean'
            ? { key, type, value: newValue as boolean }
            : { key, type, value: newValue as number[] };
    mutateSelectedStorage(() =>
      client.send('set-entry', {
        type: 'set-entry',
        target: selectedTarget,
        entry,
      }),
    );
  };

  const handleAddEntry = (entry: StorageEntry) => {
    if (!client || !selectedTarget) return;
    mutateSelectedStorage(() =>
      client.send('set-entry', {
        type: 'set-entry',
        target: selectedTarget,
        entry,
      }),
    );
  };

  const handleDeleteEntry = () => {
    if (!client || !selectedTarget || !deleteKey) return;
    const key = deleteKey;
    setDeleteKey(null);
    mutateSelectedStorage(() =>
      client.send('delete-entry', {
        type: 'delete-entry',
        target: selectedTarget,
        key,
      }),
    );
  };

  const handlePurgeStorage = () => {
    if (!client || !selectedTarget) return;
    setShowPurgeDialog(false);
    client.send('purge-storage', {
      type: 'purge-storage',
      target: selectedTarget,
    });
  };

  const showAlert = (title: string, message: string) => setAlertState({ title, message });

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !client || !selectedTarget) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch (error) {
      showAlert('Could not read file', error instanceof Error ? error.message : String(error));
      return;
    }
    const parsed = parseSnapshot(raw);
    if (!parsed.ok) {
      showAlert('Invalid snapshot', `${parsed.error.path}: ${parsed.error.message}`);
      return;
    }
    importPreviewAbortControllerRef.current?.abort();
    const controller = new AbortController();
    importPreviewAbortControllerRef.current = controller;
    const target = selectedTarget;
    try {
      const response = await client.request({
        requestType: 'preview-import',
        responseType: 'import-preview',
        errorType: 'storage-request-error',
        payload: { type: 'preview-import', target, snapshot: parsed.snapshot },
        signal: controller.signal,
      });
      if (controller.signal.aborted || !sameTarget(target, selectedTargetRef.current ?? target))
        return;
      setImportFlight({
        phase: 'preview',
        target,
        targetLabel: selectedDescriptor
          ? `${selectedDescriptor.adapterName} / ${selectedDescriptor.storageName}`
          : 'selected storage',
        snapshot: parsed.snapshot,
        preview: response.preview,
        entriesToWrite: response.preview.acceptedEntryIndexes.map(
          (index) => parsed.snapshot.entries[index],
        ),
      });
    } catch {
      if (!controller.signal.aborted && sameTarget(target, selectedTargetRef.current ?? target)) {
        showAlert(
          'Could not preview import',
          'Could not inspect the selected storage. Please try again.',
        );
      }
    } finally {
      if (importPreviewAbortControllerRef.current === controller)
        importPreviewAbortControllerRef.current = null;
    }
  };

  const handleApplyImport = () => {
    if (!client || importFlight?.phase !== 'preview') return;
    const requestId = `import-${++importRequestIdRef.current}`;
    activeImportRequestIdRef.current = requestId;
    client.send('import-entries', {
      type: 'import-entries',
      requestId,
      target: importFlight.target,
      entries: importFlight.entriesToWrite,
    });
    setImportFlight({
      phase: 'importing',
      requestId,
      target: importFlight.target,
      total: importFlight.entriesToWrite.length,
      written: 0,
    });
  };

  const handleExport = async () => {
    if (!client || !selectedTarget || exportAbortControllerRef.current) return;
    const target = selectedTarget;
    const controller = new AbortController();
    exportAbortControllerRef.current = controller;
    setExportState({ status: 'loading' });
    try {
      const response = await client.request({
        requestType: 'export-snapshot',
        responseType: 'export-snapshot-result',
        errorType: 'storage-request-error',
        payload: { type: 'export-snapshot', target },
        signal: controller.signal,
      });
      if (!controller.signal.aborted && sameTarget(target, selectedTargetRef.current ?? target)) {
        downloadJson(response.snapshot, buildExportFilename(target));
        setExportState({ status: 'idle' });
      }
    } catch {
      if (!controller.signal.aborted && sameTarget(target, selectedTargetRef.current ?? target)) {
        setExportState({
          status: 'error',
          message: 'Could not export the selected storage. Please try again.',
        });
      }
    } finally {
      if (exportAbortControllerRef.current === controller) exportAbortControllerRef.current = null;
    }
  };

  const columns = useMemo<ColumnDef<StorageEntryPreview>[]>(
    () => [
      {
        id: 'key',
        accessorKey: 'key',
        header: 'Key',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-mono text-sm text-foreground">{row.original.key}</span>
        ),
      },
      {
        id: 'type',
        accessorKey: 'type',
        header: 'Type',
        enableSorting: false,
        cell: ({ row }) => (
          <Badge tone="neutral" variant="outline">
            {row.original.type}
          </Badge>
        ),
      },
      {
        id: 'preview',
        accessorKey: 'preview',
        header: 'Value',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="break-all font-mono text-sm text-foreground">
              {row.original.preview}
            </span>
            <span
              className="ml-2 text-xs text-muted-foreground"
              title={
                row.original.isTruncated ? `Full value size: ${row.original.valueSize}` : undefined
              }
            >
              {row.original.isTruncated
                ? `truncated · ${row.original.valueSize}`
                : row.original.valueSize}
            </span>
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
            <IconButton
              tone="neutral"
              variant="ghost"
              onClick={() => setInteraction({ key: row.original.key, mode: 'edit' })}
              label={`Edit value for ${row.original.key}`}
            >
              <Edit3 className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              tone="neutral"
              variant="ghost"
              className="text-muted-foreground hover:text-danger"
              onClick={() => setDeleteKey(row.original.key)}
              label={`Delete entry ${row.original.key}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        ),
      },
    ],
    [],
  );
  const sorting: SortingState = [{ id: 'key', desc: keySortDirection === 'descending' }];
  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    const keySort = next.find((item) => item.id === 'key');
    setKeySortDirection(keySort?.desc ? 'descending' : 'ascending');
  };
  const fetchNextPage = () => {
    if (
      !previews.hasNextPage ||
      previews.isFetching ||
      previews.isFetchingNextPage ||
      isFetchingNextPageRef.current
    )
      return;
    isFetchingNextPageRef.current = true;
    void previews.fetchNextPage().finally(() => {
      isFetchingNextPageRef.current = false;
    });
  };
  const fetchPreviousPage = () => {
    if (
      !previews.hasPreviousPage ||
      previews.isFetching ||
      previews.isFetchingPreviousPage ||
      isFetchingPreviousPageRef.current
    )
      return;
    isFetchingPreviousPageRef.current = true;
    void previews.fetchPreviousPage().finally(() => {
      isFetchingPreviousPageRef.current = false;
    });
  };
  const selectedStorageViewId = selectedTarget ? getStorageViewId(selectedTarget) : '';

  return (
    <PluginShell className="h-screen">
      <PluginShell.Body>
        <Split direction="horizontal" autoSaveId="storage">
          <Split.Pane defaultSize={22} minSize={15} maxSize={40}>
            <Sidebar className="w-full border-r-0">
              {sidebarGroups.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-sidebar-foreground/60">
                  Waiting for storages…
                </div>
              ) : (
                sidebarGroups.map((group) => (
                  <Sidebar.Group key={group.adapterId} label={group.adapterName}>
                    {group.items.map((item) => (
                      <Sidebar.Item
                        key={item.viewId}
                        selected={item.viewId === selectedStorageViewId}
                        leading={<Database />}
                        trailing={<Badge tone="neutral">{item.entryCount}</Badge>}
                        onClick={() => {
                          const descriptor = descriptors.find(
                            (candidate) => getStorageViewId(candidate.target) === item.viewId,
                          );
                          if (descriptor) setSelectedTarget(descriptor.target);
                        }}
                      >
                        {item.storageName}
                      </Sidebar.Item>
                    ))}
                  </Sidebar.Group>
                ))
              )}
            </Sidebar>
          </Split.Pane>
          <Split.Handle />
          <Split.Pane>
            <div className="flex h-full min-h-0 flex-col">
              <Toolbar>
                <Toolbar.Group>
                  <Toolbar.Button
                    onClick={() => setShowAddDialog(true)}
                    disabled={!selectedDescriptor}
                    aria-label="Add entry"
                    title="Add entry"
                    className="w-7 px-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Toolbar.Button>
                  <Toolbar.Button
                    onClick={() => setShowPurgeDialog(true)}
                    disabled={!client || !selectedTarget || previews.isFetching}
                    aria-label="Purge storage"
                    title="Purge storage"
                    className="w-7 px-0 text-muted-foreground hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Toolbar.Button>
                </Toolbar.Group>
                <Toolbar.Separator />
                <Toolbar.Group>
                  <Toolbar.Button
                    onClick={() => void refreshSelectedStorage()}
                    disabled={!selectedTarget || previews.isFetching}
                    aria-label="Refresh storage"
                    title="Refresh storage"
                    className="w-7 px-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Toolbar.Button>
                </Toolbar.Group>
                <Toolbar.Separator />
                <Toolbar.Group>
                  <Toolbar.Button
                    onClick={handleImportClick}
                    disabled={!selectedDescriptor}
                    aria-label="Import storage"
                    title="Import storage"
                    className="w-7 px-0"
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </Toolbar.Button>
                  <Toolbar.Button
                    onClick={handleExport}
                    disabled={!client || !selectedTarget || exportState.status === 'loading'}
                    aria-label={
                      exportState.status === 'loading' ? 'Exporting storage' : 'Export storage'
                    }
                    title={
                      exportState.status === 'loading' ? 'Exporting storage' : 'Export storage'
                    }
                    className="w-7 px-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Toolbar.Button>
                </Toolbar.Group>
                <Toolbar.Separator />
                <div className="min-w-40 flex-1">
                  <SearchField
                    placeholder="Search keys…"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    onClear={() => setSearchTerm('')}
                    disabled={!selectedDescriptor}
                  />
                </div>
                {exportState.status === 'error' ? (
                  <span role="alert" className="text-xs text-danger">
                    {exportState.message}
                  </span>
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </Toolbar>
              <div className="min-h-0 flex-1 overflow-auto">
                {selectedDescriptor ? (
                  <VirtualizedDataTable
                    key={virtualListVersion}
                    ariaLabel="Storage entries"
                    columns={columns}
                    data={rows}
                    getRowId={(entry) => entry.key}
                    getRowTextValue={(entry) => entry.key}
                    loading={previews.isLoading}
                    emptyMessage={
                      debouncedSearch ? 'No entries match your search.' : 'This storage is empty.'
                    }
                    manualSorting
                    onEndReached={fetchNextPage}
                    onRowClick={(entry) => setInteraction({ key: entry.key, mode: 'detail' })}
                    onSortingChange={handleSortingChange}
                    onStartReached={fetchPreviousPage}
                    scrollClassName="h-full w-full overflow-auto"
                    style={{ height: '100%' }}
                    sorting={sorting}
                  />
                ) : (
                  <EmptyState
                    className="flex-1"
                    icon={Database}
                    title="No storage selected"
                    description="Choose a storage from the sidebar to inspect its entries."
                  />
                )}
              </div>
            </div>
          </Split.Pane>
        </Split>
      </PluginShell.Body>
      <AddEntryDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAddEntry={handleAddEntry}
        existingKeys={rows.map((entry) => entry.key)}
        supportedTypes={supportedTypes}
      />
      <EntryDetailDialog
        open={interaction?.mode === 'detail' && fullEntry.entry != null}
        onOpenChange={(open) => {
          if (!open) closeInteraction();
        }}
        onEdit={() =>
          setInteraction((current) => (current ? { ...current, mode: 'edit' } : current))
        }
        entry={fullEntry.entry ?? null}
      />
      <EditEntryDialog
        isOpen={interaction?.mode === 'edit' && fullEntry.entry != null}
        onClose={closeInteraction}
        onEditEntry={handleValueChange}
        entry={fullEntry.entry ?? null}
        supportedTypes={supportedTypes}
      />
      <ImportDialog
        state={importFlight}
        onApply={handleApplyImport}
        onCancel={() => setImportFlight(null)}
        onClose={() => setImportFlight(null)}
      />
      <ConfirmDialog
        open={deleteKey !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteKey(null);
        }}
        variant="confirm"
        tone="danger"
        title="Delete Entry"
        description={
          deleteKey ? `Are you sure you want to delete the entry "${deleteKey}"?` : undefined
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteEntry}
      />
      <ConfirmDialog
        open={showPurgeDialog}
        onOpenChange={setShowPurgeDialog}
        variant="confirm"
        tone="danger"
        title="Purge Storage"
        description={
          selectedDescriptor
            ? `Are you sure you want to remove all entries from "${selectedDescriptor.storageName}"? This action cannot be undone.`
            : 'Are you sure you want to remove all entries from this storage? This action cannot be undone.'
        }
        confirmLabel="Purge"
        onConfirm={handlePurgeStorage}
      />
      <ConfirmDialog
        open={alertState !== null}
        onOpenChange={(open) => {
          if (!open) setAlertState(null);
        }}
        variant="alert"
        title={alertState?.title ?? ''}
        description={alertState?.message}
      />
    </PluginShell>
  );
}

export default function StoragePanel() {
  return (
    <StorageQueryClientProvider>
      <StoragePanelContent />
    </StorageQueryClientProvider>
  );
}
