import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useMemo, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import type {
  StorageDeleteEntryEvent,
  StorageEventMap,
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
import { EditableTable } from './editable-table';
import { AddEntryDialog } from './add-entry-dialog';
import { EntryDetailDialog } from './entry-detail-dialog';
import { EditEntryDialog } from './edit-entry-dialog';
import './globals.css';

type StorageSnapshotState = {
  target: StorageTarget;
  adapterName: string;
  storageName: string;
  capabilities: StorageCapabilities;
  entries: StorageEntry[];
};

const getEntryTypeFromValue = (value: StorageEntryValue): StorageEntry['type'] => {
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
    new Map()
  );
  const [selectedStorageViewId, setSelectedStorageViewId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<StorageEntry | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<StorageEntry | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

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
      }
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
          (entry) => entry.key === event.entry.key
        );

        const entries =
          existingIndex >= 0
            ? current.entries.map((entry) =>
                entry.key === event.entry.key ? event.entry : entry
              )
            : [...current.entries, event.entry];

        next.set(viewId, {
          ...current,
          entries,
        });

        return next;
      });
      }
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
      }
    );

    client.send('get-snapshot', {
      type: 'get-snapshot',
      target: 'all',
    });

    return () => {
      snapshotSubscription.remove();
      setEntrySubscription.remove();
      deleteEntrySubscription.remove();
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
        `[Rozenite] Storage Plugin: Invalid storage view id "${selectedStorageViewId}".`
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
    ? snapshots.get(selectedStorageViewId) ?? null
    : null;

  const entries = selectedStorage?.entries ?? [];

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) =>
        entry.key.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [entries, searchTerm]
  );

  const supportedTypes = selectedStorage?.capabilities.supportedTypes ?? [];

  const updateEntriesForSelectedStorage = (
    mutate: (entries: StorageEntry[]) => StorageEntry[]
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
      currentEntries.map((entry) => (entry.key === key ? updatedEntry : entry))
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
      currentEntries.filter((entry) => entry.key !== key)
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

    updateEntriesForSelectedStorage((currentEntries) => [...currentEntries, entry]);
  };

  const storageOptions = [...snapshots.entries()].map(([viewId, snapshot]) => ({
    viewId,
    label: `${snapshot.adapterName} / ${snapshot.storageName}`,
  }));

  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200">Storage</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <label htmlFor="storage-select" className="text-xs text-gray-400">
            Storage:
          </label>
          <select
            id="storage-select"
            value={selectedStorageViewId ?? ''}
            onChange={(event) => setSelectedStorageViewId(event.target.value)}
            disabled={snapshots.size === 0}
            className="h-8 px-2 text-xs bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {snapshots.size === 0 ? (
              <option>No storages found</option>
            ) : (
              storageOptions.map((option) => (
                <option key={option.viewId} value={option.viewId}>
                  {option.label}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
        <button
          onClick={() => setShowAddDialog(true)}
          disabled={!selectedStorage}
          className="flex items-center gap-1 px-3 h-8 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
          title="Add new entry"
        >
          <Plus className="h-3 w-3" />
          Add Entry
        </button>
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search keys..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-8 w-full pl-8 pr-3 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {filteredEntries.length} of {entries.length} entries
        </div>
      </div>

      <main className="flex flex-1 min-h-0 overflow-auto">
        {selectedStorage ? (
          filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center w-full">
              <h3 className="text-lg font-semibold text-gray-200 mb-2">
                No entries found
              </h3>
              <p className="text-gray-400 text-sm">
                {searchTerm
                  ? 'Try adjusting your search terms'
                  : 'This storage appears to be empty'}
              </p>
            </div>
          ) : (
            <EditableTable
              data={filteredEntries}
              supportedTypes={supportedTypes}
              onValueChange={handleValueChange}
              onDeleteEntry={handleDeleteEntry}
              onRowClick={(entry) => {
                setSelectedEntry(entry);
                setShowDetailDialog(true);
              }}
              loading={loading}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center w-full">
            <h2 className="text-xl font-semibold text-gray-200 mb-2">
              Welcome to Storage Inspector
            </h2>
            <p className="text-gray-400 text-sm">
              Select a storage from the dropdown above to inspect data
            </p>
          </div>
        )}
      </main>

      <AddEntryDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAddEntry={handleAddEntry}
        existingKeys={entries.map((entry) => entry.key)}
        supportedTypes={supportedTypes}
      />

      <EntryDetailDialog
        isOpen={showDetailDialog}
        onClose={() => {
          setShowDetailDialog(false);
          setSelectedEntry(null);
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
    </div>
  );
}
