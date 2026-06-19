import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ListBox,
  PluginHeader,
  PluginTheme,
  Select,
  SearchField,
} from '@rozenite/ui';
import { Download, Upload } from 'lucide-react';
import type {
  StorageDeleteEntryEvent,
  StorageEventMap,
  StorageImportResultEvent,
  StorageSetEntryEvent,
  StorageSnapshotEvent,
} from '../shared/messaging';
import type {
  StorageCapabilities,
  StorageEntry,
  StorageEntryValue,
  StorageTarget,
} from '../shared/types';
import { getStorageViewId } from '../shared/types';
import {
  buildSnapshot,
  computePreview,
  parseSnapshot,
} from '../shared/snapshot';
import { EditableTable } from './editable-table';
import { AddEntryDialog } from './add-entry-dialog';
import { EntryDetailDialog } from './entry-detail-dialog';
import { EditEntryDialog } from './edit-entry-dialog';
import { ConfirmDialog } from './confirm-dialog';
import { ImportDialog, type ImportFlightState } from './import-dialog';
import { buildExportFilename, downloadJson } from './utils';
import './globals.css';

type StorageSnapshotState = {
  target: StorageTarget;
  adapterName: string;
  storageName: string;
  capabilities: StorageCapabilities;
  blacklist?: RegExp;
  entries: StorageEntry[];
};

type AlertState = {
  isOpen: boolean;
  title: string;
  message: string;
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

export default function StoragePanel() {
  const [snapshots, setSnapshots] = useState<Map<string, StorageSnapshotState>>(
    new Map(),
  );
  const [selectedStorageViewId, setSelectedStorageViewId] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<StorageEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<StorageEntry | null>(null);
  const [importFlight, setImportFlight] = useState<ImportFlightState | null>(
    null,
  );
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    title: '',
    message: '',
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        const viewId = getStorageViewId(event.target);
        setSnapshots((previous) => {
          const next = new Map(previous);
          next.set(viewId, {
            target: event.target,
            adapterName: event.adapterName,
            storageName: event.storageName,
            capabilities: event.capabilities,
            blacklist: event.blacklist
              ? new RegExp(event.blacklist.source, event.blacklist.flags)
              : undefined,
            entries: event.entries,
          });

          if (previous.size === 0 && !selectedStorageViewId) {
            setSelectedStorageViewId(viewId);
          }

          return next;
        });

        if (viewId === selectedStorageViewId) {
          setLoading(false);
        }
      },
    );

    const setEntrySubscription = client.onMessage(
      'set-entry',
      (event: StorageSetEntryEvent) => {
        const viewId = getStorageViewId(event.target);
        setSnapshots((previous) => {
          const next = new Map(previous);
          const current = next.get(viewId);

          if (!current) {
            return previous;
          }

          const existingIndex = current.entries.findIndex(
            (entry) => entry.key === event.entry.key,
          );

          const entries =
            existingIndex >= 0
              ? current.entries.map((entry) =>
                  entry.key === event.entry.key ? event.entry : entry,
                )
              : [...current.entries, event.entry];

          next.set(viewId, {
            ...current,
            entries,
          });

          return next;
        });

        setImportFlight((previous) => {
          if (!previous || previous.phase !== 'importing') return previous;
          if (!sameTarget(event.target, previous.target)) return previous;
          return { ...previous, written: previous.written + 1 };
        });
      },
    );

    const importResultSubscription = client.onMessage(
      'import-result',
      (event: StorageImportResultEvent) => {
        setImportFlight((previous) => {
          if (!previous || previous.phase !== 'importing') return previous;
          if (!sameTarget(event.target, previous.target)) return previous;
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
        const viewId = getStorageViewId(event.target);

        setSnapshots((previous) => {
          const next = new Map(previous);
          const current = next.get(viewId);

          if (!current) {
            return previous;
          }

          next.set(viewId, {
            ...current,
            entries: current.entries.filter((entry) => entry.key !== event.key),
          });

          return next;
        });
      },
    );

    client.send('get-snapshot', {
      type: 'get-snapshot',
      target: 'all',
    });

    return () => {
      snapshotSubscription.remove();
      setEntrySubscription.remove();
      deleteEntrySubscription.remove();
      importResultSubscription.remove();
    };
  }, [client, selectedStorageViewId]);

  useEffect(() => {
    if (!client || !selectedStorageViewId) {
      return;
    }

    const selectedSnapshot = snapshots.get(selectedStorageViewId);

    if (selectedSnapshot) {
      setLoading(false);
      return;
    }

    const separatorIndex = selectedStorageViewId.indexOf(':');
    if (separatorIndex < 0) {
      console.warn(
        `[Rozenite] Storage Plugin: Invalid storage view id "${selectedStorageViewId}".`,
      );
      setLoading(false);
      return;
    }

    const adapterId = selectedStorageViewId.slice(0, separatorIndex);
    const storageId = selectedStorageViewId.slice(separatorIndex + 1);

    setLoading(true);
    client.send('get-snapshot', {
      type: 'get-snapshot',
      target: {
        adapterId,
        storageId,
      },
    });
  }, [client, selectedStorageViewId, snapshots]);

  const selectedStorage = selectedStorageViewId
    ? (snapshots.get(selectedStorageViewId) ?? null)
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

  const updateEntriesForSelectedStorage = (
    mutate: (entries: StorageEntry[]) => StorageEntry[],
  ) => {
    if (!selectedStorageViewId) {
      return;
    }

    setSnapshots((previous) => {
      const next = new Map(previous);
      const current = next.get(selectedStorageViewId);

      if (!current) {
        return previous;
      }

      next.set(selectedStorageViewId, {
        ...current,
        entries: mutate(current.entries),
      });

      return next;
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
    setAlertState({ isOpen: true, title, message });

  const handleImportClick = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !selectedStorage) {
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

    const preview = computePreview(parsed.snapshot, {
      target: selectedStorage.target,
      capabilities: selectedStorage.capabilities,
      entryKeys: new Set(selectedStorage.entries.map((entry) => entry.key)),
      isBlacklisted: selectedStorage.blacklist
        ? (key) => selectedStorage.blacklist!.test(key)
        : () => false,
    });

    const skippedSet = new Set(preview.skippedKeys.map((s) => s.key));
    const unsupportedSet = new Set(preview.unsupportedTypes.map((u) => u.key));
    const entriesToWrite = parsed.snapshot.entries.filter(
      (entry) => !skippedSet.has(entry.key) && !unsupportedSet.has(entry.key),
    );

    setImportFlight({
      phase: 'preview',
      target: selectedStorage.target,
      targetLabel: `${selectedStorage.adapterName} / ${selectedStorage.storageName}`,
      snapshot: parsed.snapshot,
      preview,
      entriesToWrite,
    });
  };

  const handleApplyImport = () => {
    if (!client) return;
    if (!importFlight || importFlight.phase !== 'preview') return;

    client.send('import-entries', {
      type: 'import-entries',
      target: importFlight.target,
      entries: importFlight.entriesToWrite,
    });

    setImportFlight({
      phase: 'importing',
      target: importFlight.target,
      total: importFlight.entriesToWrite.length,
      written: 0,
    });
  };

  const handleCloseImport = () => setImportFlight(null);

  const handleExport = () => {
    if (!selectedStorage) return;
    const snapshot = buildSnapshot({
      target: selectedStorage.target,
      adapterName: selectedStorage.adapterName,
      storageName: selectedStorage.storageName,
      capabilities: selectedStorage.capabilities,
      entries: selectedStorage.entries,
    });
    downloadJson(snapshot, buildExportFilename(selectedStorage.target));
  };

  const storageOptions = [...snapshots.entries()].map(([viewId, snapshot]) => ({
    viewId,
    label: `${snapshot.adapterName} / ${snapshot.storageName}`,
  }));

  return (
    <PluginTheme
      defaultTheme="dark"
      storageKey="@rozenite/storage-plugin.theme"
      className="flex h-screen flex-col bg-background text-foreground"
    >
      <PluginHeader
        title="Storage"
        actions={
          <div className="w-56 max-w-[44vw] min-w-40">
            <Select
              placeholder="Select storage"
              value={selectedStorageViewId ?? ''}
              onChange={(value) =>
                setSelectedStorageViewId(
                  typeof value === 'string'
                    ? value
                    : value == null
                      ? null
                      : String(value),
                )
              }
              isDisabled={snapshots.size === 0}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {storageOptions.map((option) => (
                    <ListBox.Item
                      key={option.viewId}
                      id={option.viewId}
                      textValue={option.label}
                    >
                      {option.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        }
      />

      <div className="flex items-center gap-2 px-3 pb-3 pt-3">
        <AddEntryDialog
          isDisabled={!selectedStorage}
          onAddEntry={handleAddEntry}
          existingKeys={entries.map((entry) => entry.key)}
          supportedTypes={supportedTypes}
        />
        <button
          onClick={handleImportClick}
          disabled={!selectedStorage}
          className="flex items-center gap-1 px-3 h-8 text-xs bg-surface-secondary hover:bg-surface-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed text-foreground rounded transition-colors border border-border/70"
          title="Import entries from a JSON snapshot"
        >
          <Upload className="h-3 w-3" />
          Import
        </button>
        <button
          onClick={handleExport}
          disabled={!selectedStorage || entries.length === 0}
          className="flex items-center gap-1 px-3 h-8 text-xs bg-surface-secondary hover:bg-surface-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed text-foreground rounded transition-colors border border-border/70"
          title="Export entries to a JSON snapshot"
        >
          <Download className="h-3 w-3" />
          Export
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex-1">
          <SearchField
            name="search"
            fullWidth
            value={searchTerm}
            onChange={setSearchTerm}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search keys..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </div>
        <div className="flex items-center gap-2 text-xs text-default-foreground">
          {filteredEntries.length} of {entries.length} entries
        </div>
      </div>

      <main className="flex flex-1 min-h-0 overflow-auto">
        {selectedStorage ? (
          <EditableTable
            data={filteredEntries}
            loading={loading}
            onDeleteEntry={handleDeleteEntry}
            onRowClick={setSelectedEntry}
            onValueChange={handleValueChange}
            searchTerm={searchTerm}
            supportedTypes={supportedTypes}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center w-full">
            <h2 className="text-xl font-semibold text-default-foreground mb-2">
              Welcome to Storage Inspector
            </h2>
            <p className="text-default-foreground text-sm">
              Select a storage from the dropdown above to inspect data
            </p>
          </div>
        )}
      </main>

      <EntryDetailDialog
        onClose={() => setSelectedEntry(null)}
        onEdit={(entry) => {
          setSelectedEntry(null);
          setEditingEntry(entry);
        }}
        entry={selectedEntry}
      />

      <EditEntryDialog
        onClose={() => setEditingEntry(null)}
        onEditEntry={(key, newValue) => {
          handleValueChange(key, newValue);
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
        isOpen={alertState.isOpen}
        onClose={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
        title={alertState.title}
        message={alertState.message}
        type="alert"
      />
    </PluginTheme>
  );
}
