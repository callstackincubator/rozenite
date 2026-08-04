import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  DataTableEditableCell,
  EmptyState,
  PluginShell,
  SearchField,
  Sidebar,
  Split,
  Toolbar,
  type DataTableColumn,
} from '@rozenite/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Database,
  Download,
  Edit3,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  StorageDeleteEntryEvent,
  StorageDiscoverStoragesResponseEvent,
  StorageEventMap,
  StorageImportProgressEvent,
  StorageImportResultEvent,
  StorageSetEntryEvent,
  StorageSnapshotEvent,
} from '../shared/messaging';
import type {
  StorageCapabilities,
  StorageDescriptor,
  StorageEntry,
  StorageEntryValue,
  StorageTarget,
} from '../shared/types';
import { getStorageViewId } from '../shared/types';
import { parseSnapshot } from '../shared/snapshot';
import {
  buildStorageSidebarGroups,
  type StorageSnapshotEntry,
} from './storage-groups';
import { AddEntryDialog } from './add-entry-dialog';
import { EditEntryDialog } from './edit-entry-dialog';
import { EntryDetailDialog } from './entry-detail-dialog';
import { ImportDialog, type ImportFlightState } from './import-dialog';
import { formatValue } from './format-value';
import { buildExportFilename, downloadJson } from './utils';
import { StorageQueryClientProvider } from './query-client';
import './globals.css';

type StorageSnapshotState = {
  target: StorageTarget;
  adapterName: string;
  storageName: string;
  capabilities: StorageCapabilities;
  entries: StorageEntry[];
};

type AlertState = {
  title: string;
  message: string;
};

type DeleteConfirmState = {
  key: string;
};

const sameTarget = (a: StorageTarget, b: StorageTarget) =>
  a.adapterId === b.adapterId && a.storageId === b.storageId;

const getEntryTypeFromValue = (
  value: StorageEntryValue,
): StorageEntry['type'] => {
  if (typeof value === 'string') {
    return 'string';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  return 'buffer';
};

function StoragePanelContent() {
  const [descriptors, setDescriptors] = useState<StorageDescriptor[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<StorageTarget | null>(
    null,
  );
  const [selectedSnapshot, setSelectedSnapshot] =
    useState<StorageSnapshotState | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [exportState, setExportState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
  >({ status: 'idle' });
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<StorageEntry | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<StorageEntry | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [importFlight, setImportFlight] = useState<ImportFlightState | null>(
    null,
  );
  const [alertState, setAlertState] = useState<AlertState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedTargetRef = useRef<StorageTarget | null>(null);
  const discoveryRequestIdRef = useRef(0);
  const exportAbortControllerRef = useRef<AbortController | null>(null);
  const importPreviewAbortControllerRef = useRef<AbortController | null>(null);
  const importRequestIdRef = useRef(0);
  const activeImportRequestIdRef = useRef<string | null>(null);
  const importTargetRef = useRef<StorageTarget | null>(null);

  const client = useRozeniteDevToolsClient<StorageEventMap>({
    pluginId: '@rozenite/storage-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const snapshotSubscription = client.onMessage(
      'snapshot',
      (event: StorageSnapshotEvent) => {
        if (
          !selectedTargetRef.current ||
          !sameTarget(event.target, selectedTargetRef.current)
        ) {
          return;
        }

        setSelectedSnapshot({
          target: event.target,
          adapterName: event.adapterName,
          storageName: event.storageName,
          capabilities: event.capabilities,
          entries: event.entries,
        });
        setLoading(false);
      },
    );

    const descriptorsSubscription = client.onMessage(
      'storage-descriptors',
      (event: StorageDiscoverStoragesResponseEvent) => {
        if (event.requestId !== `discovery-${discoveryRequestIdRef.current}`) {
          return;
        }

        setDescriptors(event.storages);
        setSelectedTarget((previous) => {
          if (
            previous &&
            event.storages.some((descriptor) =>
              sameTarget(descriptor.target, previous),
            )
          ) {
            return previous;
          }

          return event.storages[0]?.target ?? null;
        });
      },
    );

    const setEntrySubscription = client.onMessage(
      'set-entry',
      (event: StorageSetEntryEvent) => {
        setSelectedSnapshot((current) => {
          if (!current || !sameTarget(event.target, current.target))
            return current;

          const existingIndex = current.entries.findIndex(
            (entry) => entry.key === event.entry.key,
          );

          const entries =
            existingIndex >= 0
              ? current.entries.map((entry) =>
                  entry.key === event.entry.key ? event.entry : entry,
                )
              : [...current.entries, event.entry];

          return { ...current, entries };
        });
      },
    );

    const importProgressSubscription = client.onMessage(
      'import-progress',
      (event: StorageImportProgressEvent) => {
        setImportFlight((previous) => {
          if (!previous || previous.phase !== 'importing') return previous;
          if (
            previous.requestId !== event.requestId ||
            !sameTarget(event.target, previous.target)
          ) {
            return previous;
          }
          return { ...previous, written: event.written, total: event.total };
        });
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
          setRefreshVersion((version) => version + 1);
        }
        setImportFlight((previous) => {
          if (!previous || previous.phase !== 'importing') return previous;
          if (
            previous.requestId !== event.requestId ||
            !sameTarget(event.target, previous.target)
          ) {
            return previous;
          }
          if (event.ok) {
            return { phase: 'result', ok: true, written: event.written };
          }
          return {
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

    const deleteEntrySubscription = client.onMessage(
      'delete-entry',
      (event: StorageDeleteEntryEvent) => {
        setSelectedSnapshot((current) => {
          if (!current || !sameTarget(event.target, current.target))
            return current;

          return {
            ...current,
            entries: current.entries.filter((entry) => entry.key !== event.key),
          };
        });
      },
    );

    discoveryRequestIdRef.current += 1;
    client.send('discover-storages', {
      type: 'discover-storages',
      requestId: `discovery-${discoveryRequestIdRef.current}`,
    });

    return () => {
      snapshotSubscription.remove();
      descriptorsSubscription.remove();
      setEntrySubscription.remove();
      importProgressSubscription.remove();
      deleteEntrySubscription.remove();
      importResultSubscription.remove();
    };
  }, [client]);

  useEffect(() => {
    selectedTargetRef.current = selectedTarget;
    exportAbortControllerRef.current?.abort();
    exportAbortControllerRef.current = null;
    importPreviewAbortControllerRef.current?.abort();
    importPreviewAbortControllerRef.current = null;
    setExportState({ status: 'idle' });
    setSelectedSnapshot(null);
    setSelectedEntry(null);
    setEditingEntry(null);

    if (!client || !selectedTarget) {
      setLoading(false);
      return;
    }

    setLoading(true);
    client.send('get-snapshot', {
      type: 'get-snapshot',
      target: selectedTarget,
    });
  }, [client, refreshVersion, selectedTarget]);

  useEffect(
    () => () => {
      exportAbortControllerRef.current?.abort();
      importPreviewAbortControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (
      importTargetRef.current &&
      (!selectedTarget || !sameTarget(importTargetRef.current, selectedTarget))
    ) {
      activeImportRequestIdRef.current = null;
      setImportFlight(null);
    }
    importTargetRef.current = selectedTarget;
  }, [selectedTarget]);

  const selectedStorage =
    selectedSnapshot &&
    selectedTarget &&
    sameTarget(selectedSnapshot.target, selectedTarget)
      ? selectedSnapshot
      : null;

  const entries = selectedStorage?.entries ?? [];

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) =>
        entry.key.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [entries, searchTerm],
  );

  const supportedTypes = selectedStorage?.capabilities.supportedTypes ?? [];

  const sidebarGroups = useMemo(() => {
    const summary = new Map<string, StorageSnapshotEntry>();

    for (const descriptor of descriptors) {
      const viewId = getStorageViewId(descriptor.target);
      const snapshot =
        selectedSnapshot && sameTarget(descriptor.target, selectedSnapshot.target)
          ? selectedSnapshot
          : null;

      summary.set(viewId, {
        target: descriptor.target,
        adapterName: descriptor.adapterName,
        storageName: descriptor.storageName,
        entryCount: snapshot?.entries.length ?? 0,
      });
    }

    return buildStorageSidebarGroups(summary);
  }, [descriptors, selectedSnapshot]);

  const updateEntriesForSelectedStorage = (
    mutate: (entries: StorageEntry[]) => StorageEntry[],
  ) => {
    setSelectedSnapshot((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        entries: mutate(current.entries),
      };
    });
  };

  const handleValueChange = (key: string, newValue: StorageEntryValue) => {
    if (!client || !selectedStorage) {
      return;
    }

    const type = getEntryTypeFromValue(newValue);

    if (!selectedStorage.capabilities.supportedTypes.includes(type)) {
      return;
    }

    let updatedEntry: StorageEntry;
    if (type === 'string') {
      updatedEntry = { key, type: 'string', value: newValue as string };
    } else if (type === 'number') {
      updatedEntry = { key, type: 'number', value: newValue as number };
    } else if (type === 'boolean') {
      updatedEntry = { key, type: 'boolean', value: newValue as boolean };
    } else {
      updatedEntry = { key, type: 'buffer', value: newValue as number[] };
    }

    client.send('set-entry', {
      type: 'set-entry',
      target: selectedStorage.target,
      entry: updatedEntry,
    });

    updateEntriesForSelectedStorage((currentEntries) =>
      currentEntries.map((entry) => (entry.key === key ? updatedEntry : entry)),
    );
  };

  const handleDeleteEntry = (key: string) => {
    if (!client || !selectedStorage) {
      return;
    }

    client.send('delete-entry', {
      type: 'delete-entry',
      target: selectedStorage.target,
      key,
    });

    updateEntriesForSelectedStorage((currentEntries) =>
      currentEntries.filter((entry) => entry.key !== key),
    );
  };

  const handleAddEntry = (entry: StorageEntry) => {
    if (!client || !selectedStorage) {
      return;
    }

    client.send('set-entry', {
      type: 'set-entry',
      target: selectedStorage.target,
      entry,
    });

    updateEntriesForSelectedStorage((currentEntries) => [
      ...currentEntries,
      entry,
    ]);
  };

  const showAlert = (title: string, message: string) =>
    setAlertState({ title, message });

  const handleImportClick = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !client || !selectedTarget) {
      return;
    }

    let raw: unknown;
    try {
      const text = await file.text();
      raw = JSON.parse(text);
    } catch (parseError) {
      showAlert(
        'Could not read file',
        parseError instanceof Error ? parseError.message : String(parseError),
      );
      return;
    }

    const parsed = parseSnapshot(raw);
    if (!parsed.ok) {
      showAlert(
        'Invalid snapshot',
        `${parsed.error.path}: ${parsed.error.message}`,
      );
      return;
    }

    importPreviewAbortControllerRef.current?.abort();
    const controller = new AbortController();
    importPreviewAbortControllerRef.current = controller;
    const target = selectedTarget;
    const selectedDescriptor = descriptors.find((descriptor) =>
      sameTarget(descriptor.target, target),
    );
    const targetLabel = selectedDescriptor
      ? `${selectedDescriptor.adapterName} / ${selectedDescriptor.storageName}`
      : 'selected storage';

    try {
      const response = await client.request({
        requestType: 'preview-import',
        responseType: 'import-preview',
        errorType: 'storage-request-error',
        payload: { type: 'preview-import', target, snapshot: parsed.snapshot },
        signal: controller.signal,
      });
      if (
        controller.signal.aborted ||
        !sameTarget(target, selectedTargetRef.current ?? target)
      ) {
        return;
      }

      const entriesToWrite = response.preview.acceptedEntryIndexes.map(
        (index) => parsed.snapshot.entries[index],
      );
      setImportFlight({
        phase: 'preview',
        target,
        targetLabel,
        snapshot: parsed.snapshot,
        preview: response.preview,
        entriesToWrite,
      });
    } catch {
      if (
        !controller.signal.aborted &&
        sameTarget(target, selectedTargetRef.current ?? target)
      ) {
        showAlert(
          'Could not preview import',
          'Could not inspect the selected storage. Please try again.',
        );
      }
    } finally {
      if (importPreviewAbortControllerRef.current === controller) {
        importPreviewAbortControllerRef.current = null;
      }
    }
  };

  const handleApplyImport = () => {
    if (!client) return;
    if (!importFlight || importFlight.phase !== 'preview') return;

    importRequestIdRef.current += 1;
    const requestId = `import-${importRequestIdRef.current}`;
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

  const handleCloseImport = () => setImportFlight(null);

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

      if (
        controller.signal.aborted ||
        !sameTarget(target, selectedTargetRef.current ?? target)
      ) {
        return;
      }

      downloadJson(response.snapshot, buildExportFilename(target));
      setExportState({ status: 'idle' });
    } catch {
      if (
        !controller.signal.aborted &&
        sameTarget(target, selectedTargetRef.current ?? target)
      ) {
        setExportState({
          status: 'error',
          message: 'Could not export the selected storage. Please try again.',
        });
      }
    } finally {
      if (exportAbortControllerRef.current === controller) {
        exportAbortControllerRef.current = null;
      }
    }
  };

  const columns = useMemo<DataTableColumn<StorageEntry>[]>(
    () => [
      {
        accessorKey: 'key',
        header: 'Key',
        cell: ({ getValue }) => (
          <span className="font-mono text-sm text-foreground">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ getValue }) => (
          <Badge variant="outline">{getValue<string>()}</Badge>
        ),
      },
      {
        id: 'value',
        header: 'Value',
        enableSorting: false,
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <div className="flex items-center gap-2">
              {entry.type === 'string' ? (
                <span
                  className="min-w-0 flex-1"
                  onClick={(event) => event.stopPropagation()}
                >
                  <DataTableEditableCell
                    value={entry.value}
                    onCommit={(next) => handleValueChange(entry.key, next)}
                    className="font-mono"
                  />
                </span>
              ) : (
                <span className="min-w-0 flex-1 truncate">
                  {formatValue(entry)}
                </span>
              )}
              <span onClick={(event) => event.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingEntry(entry);
                    setShowEditDialog(true);
                  }}
                  aria-label={`Edit value for ${entry.key}`}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
              </span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div onClick={(event) => event.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteConfirm({ key: row.original.key })}
              aria-label={`Delete entry ${row.original.key}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [handleValueChange],
  );

  const selectedStorageViewId = selectedTarget
    ? getStorageViewId(selectedTarget)
    : '';

  return (
    <PluginShell>
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
                  <Sidebar.Group
                    key={group.adapterId}
                    label={group.adapterName}
                  >
                    {group.items.map((item) => (
                      <Sidebar.Item
                        key={item.viewId}
                        selected={item.viewId === selectedStorageViewId}
                        trailing={
                          <Badge variant="secondary">{item.entryCount}</Badge>
                        }
                        onClick={() => {
                          const descriptor = descriptors.find(
                            (candidate) =>
                              getStorageViewId(candidate.target) === item.viewId,
                          );

                          if (descriptor) {
                            activeImportRequestIdRef.current = null;
                            setImportFlight(null);
                            selectedTargetRef.current = descriptor.target;
                            setSelectedTarget(descriptor.target);
                          }
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
                    disabled={!selectedStorage}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Entry
                  </Toolbar.Button>
                  <Toolbar.Button
                    onClick={() => setRefreshVersion((version) => version + 1)}
                    disabled={!selectedTarget || loading}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </Toolbar.Button>
                  <Toolbar.Button
                    onClick={handleImportClick}
                    disabled={!selectedStorage}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Import
                  </Toolbar.Button>
                  <Toolbar.Button
                    onClick={handleExport}
                    disabled={
                      !client ||
                      !selectedTarget ||
                      exportState.status === 'loading'
                    }
                  >
                    <Download className="h-3.5 w-3.5" />
                    {exportState.status === 'loading' ? 'Exporting...' : 'Export'}
                  </Toolbar.Button>
                </Toolbar.Group>

                <Toolbar.Separator />

                <div className="min-w-40 flex-1">
                  <SearchField
                    placeholder="Search keys…"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    onClear={() => setSearchTerm('')}
                    disabled={!selectedStorage}
                  />
                </div>

                {exportState.status === 'error' ? (
                  <span role="alert" className="text-xs text-destructive">
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
                {selectedStorage ? (
                  <DataTable
                    columns={columns}
                    data={filteredEntries}
                    loading={loading}
                    getRowId={(entry) => entry.key}
                    onRowClick={(entry) => {
                      setSelectedEntry(entry);
                      setShowDetailDialog(true);
                    }}
                    emptyMessage={
                      searchTerm
                        ? 'No entries match your search.'
                        : 'This storage is empty.'
                    }
                  />
                ) : (
                  <EmptyState
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
        existingKeys={entries.map((entry) => entry.key)}
        supportedTypes={supportedTypes}
      />

      <EntryDetailDialog
        open={showDetailDialog}
        onOpenChange={(open) => {
          setShowDetailDialog(open);
          if (!open) setSelectedEntry(null);
        }}
        onEdit={(entry) => {
          setShowDetailDialog(false);
          setEditingEntry(entry);
          setShowEditDialog(true);
        }}
        entry={selectedEntry}
      />

      <EditEntryDialog
        isOpen={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setEditingEntry(null);
        }}
        onEditEntry={(key, newValue) => {
          handleValueChange(key, newValue);
          setShowEditDialog(false);
          setEditingEntry(null);
        }}
        supportedTypes={supportedTypes}
        entry={editingEntry}
      />

      <ImportDialog
        state={importFlight}
        onApply={handleApplyImport}
        onCancel={handleCloseImport}
        onClose={handleCloseImport}
      />

      <ConfirmDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
        variant="confirm"
        destructive
        title="Delete Entry"
        description={
          deleteConfirm
            ? `Are you sure you want to delete the entry "${deleteConfirm.key}"?`
            : undefined
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteConfirm) handleDeleteEntry(deleteConfirm.key);
        }}
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
