import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useMemo, useState } from 'react';
import {
  ListBox,
  PluginHeader,
  PluginTheme,
  SearchField,
  Select,
} from '@rozenite/ui';
import type {
  MMKVDeleteEntryEvent,
  MMKVEventMap,
  MMKVSetEntryEvent,
  MMKVSnapshotEvent,
} from '../shared/messaging';
import type { MMKVEntry, MMKVEntryValue } from '../shared/types';
import { EditableTable } from './editable-table';
import { AddEntryDialog } from './add-entry-dialog';
import { EntryDetailDialog } from './entry-detail-dialog';
import { EditEntryDialog } from './edit-entry-dialog';
import './globals.css';

const getEntryTypeFromValue = (value: MMKVEntryValue): MMKVEntry['type'] => {
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

export default function MMKVPanel() {
  const [instances, setInstances] = useState<Map<string, MMKVEntry[]>>(
    new Map(),
  );
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<MMKVEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<MMKVEntry | null>(null);

  const client = useRozeniteDevToolsClient<MMKVEventMap>({
    pluginId: '@rozenite/mmkv-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const snapshotSubscription = client.onMessage(
      'snapshot',
      (event: MMKVSnapshotEvent) => {
        setInstances((previous) => {
          const next = new Map(previous);
          next.set(event.id, event.entries);

          if (previous.size === 0 && !selectedInstance) {
            setSelectedInstance(event.id);
          }

          return next;
        });

        if (event.id === selectedInstance) {
          setLoading(false);
        }
      },
    );

    const setEntrySubscription = client.onMessage(
      'set-entry',
      (event: MMKVSetEntryEvent) => {
        setInstances((previous) => {
          const next = new Map(previous);
          const current = next.get(event.id);

          if (!current) {
            return previous;
          }

          const existingIndex = current.findIndex(
            (entry) => entry.key === event.entry.key,
          );

          const entries =
            existingIndex >= 0
              ? current.map((entry) =>
                  entry.key === event.entry.key ? event.entry : entry,
                )
              : [...current, event.entry];

          next.set(event.id, entries);
          return next;
        });
      },
    );

    const deleteEntrySubscription = client.onMessage(
      'delete-entry',
      (event: MMKVDeleteEntryEvent) => {
        setInstances((previous) => {
          const next = new Map(previous);
          const current = next.get(event.id);

          if (!current) {
            return previous;
          }

          next.set(
            event.id,
            current.filter((entry) => entry.key !== event.key),
          );
          return next;
        });
      },
    );

    client.send('get-snapshot', {
      type: 'get-snapshot',
      id: 'all',
    });

    return () => {
      snapshotSubscription.remove();
      setEntrySubscription.remove();
      deleteEntrySubscription.remove();
    };
  }, [client, selectedInstance]);

  useEffect(() => {
    if (!client || !selectedInstance) {
      return;
    }

    if (instances.has(selectedInstance)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    client.send('get-snapshot', {
      type: 'get-snapshot',
      id: selectedInstance,
    });
  }, [client, selectedInstance, instances]);

  const entries = selectedInstance
    ? (instances.get(selectedInstance) ?? [])
    : [];

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) =>
        entry.key.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [entries, searchTerm],
  );

  const updateEntriesForSelectedInstance = (
    mutate: (entries: MMKVEntry[]) => MMKVEntry[],
  ) => {
    if (!selectedInstance) {
      return;
    }

    setInstances((previous) => {
      const next = new Map(previous);
      const current = next.get(selectedInstance);

      if (!current) {
        return previous;
      }

      next.set(selectedInstance, mutate(current));
      return next;
    });
  };

  const handleValueChange = (key: string, newValue: MMKVEntryValue) => {
    if (!client || !selectedInstance) {
      return;
    }

    const type = getEntryTypeFromValue(newValue);

    let updatedEntry: MMKVEntry;
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
      id: selectedInstance,
      entry: updatedEntry,
    });

    updateEntriesForSelectedInstance((currentEntries) =>
      currentEntries.map((entry) => (entry.key === key ? updatedEntry : entry)),
    );
  };

  const handleDeleteEntry = (key: string) => {
    if (!client || !selectedInstance) {
      return;
    }

    client.send('delete-entry', {
      type: 'delete-entry',
      id: selectedInstance,
      key,
    });

    updateEntriesForSelectedInstance((currentEntries) =>
      currentEntries.filter((entry) => entry.key !== key),
    );
  };

  const handleAddEntry = (entry: MMKVEntry) => {
    if (!client || !selectedInstance) {
      return;
    }

    client.send('set-entry', {
      type: 'set-entry',
      id: selectedInstance,
      entry,
    });

    updateEntriesForSelectedInstance((currentEntries) => [
      ...currentEntries,
      entry,
    ]);
  };

  const instanceOptions = [...instances.keys()];

  return (
    <PluginTheme
      defaultTheme="dark"
      storageKey="@rozenite/mmkv-plugin.theme"
      className="flex h-screen flex-col bg-background text-foreground"
    >
      <div className="px-3 py-2 border-b border-amber-800/60 bg-amber-950/40 text-xs text-amber-100">
        <span className="font-semibold">Deprecated:</span>{' '}
        <code>@rozenite/mmkv-plugin</code> has been replaced by{' '}
        <a
          href="https://www.npmjs.com/package/@rozenite/storage-plugin"
          target="_blank"
          rel="noreferrer"
          className="underline decoration-amber-300/70 underline-offset-2 hover:text-white"
        >
          <code>@rozenite/storage-plugin</code>
        </a>
        , which supports more storage solutions than MMKV and offers the same functionality.
      </div>

      <PluginHeader
        title="MMKV Storage"
        actions={
          <div className="w-56 max-w-[44vw] min-w-40">
            <Select
              placeholder="Select instance"
              value={selectedInstance ?? ''}
              onChange={(value) =>
                setSelectedInstance(
                  typeof value === 'string'
                    ? value
                    : value == null
                      ? null
                      : String(value),
                )
              }
              isDisabled={instances.size === 0}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {instanceOptions.map((instanceId) => (
                    <ListBox.Item
                      key={instanceId}
                      id={instanceId}
                      textValue={instanceId}
                    >
                      {instanceId}
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
          isDisabled={!selectedInstance}
          onAddEntry={handleAddEntry}
          existingKeys={entries.map((entry) => entry.key)}
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
        {selectedInstance ? (
          <EditableTable
            data={filteredEntries}
            loading={loading}
            onDeleteEntry={handleDeleteEntry}
            onRowClick={setSelectedEntry}
            onValueChange={handleValueChange}
            searchTerm={searchTerm}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center w-full">
            <h2 className="text-xl font-semibold text-default-foreground mb-2">
              Welcome to MMKV Inspector
            </h2>
            <p className="text-default-foreground text-sm">
              Select an MMKV instance from the dropdown above to inspect data
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
        entry={editingEntry}
      />
    </PluginTheme>
  );
}
