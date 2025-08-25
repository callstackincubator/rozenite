import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { MMKVEventMap } from '../shared/messaging';
import { MMKVEntry, MMKVEntryValue } from '../shared/types';
import { EditableTable } from './editable-table';
import { AddEntryDialog } from './add-entry-dialog';
import './globals.css';

export default function MMKVPanel() {
  const [instances, setInstances] = useState<Map<string, MMKVEntry[]>>(
    new Map()
  );
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [entries, setEntries] = useState<MMKVEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);

  const client = useRozeniteDevToolsClient<MMKVEventMap>({
    pluginId: '@rozenite/mmkv-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const snapshotSubscription = client.onMessage('snapshot', (event) => {
      setInstances((prevInstances) => {
        const newInstances = new Map(prevInstances);
        newInstances.set(event.id, event.entries);

        // If this is the first instance and no instance is selected, select it
        if (prevInstances.size === 0 && !selectedInstance) {
          setSelectedInstance(event.id);
        }

        return newInstances;
      });

      // If this snapshot is for the currently selected instance, update entries
      if (event.id === selectedInstance) {
        setEntries(event.entries);
        setLoading(false);
      }
    });

    const setEntrySubscription = client.onMessage('set-entry', (event) => {
      if (event.id === selectedInstance) {
        setEntries((prevEntries) => {
          const existingIndex = prevEntries.findIndex(
            (entry) => entry.key === event.entry.key
          );
          if (existingIndex >= 0) {
            // Update existing entry
            return prevEntries.map((entry) =>
              entry.key === event.entry.key ? event.entry : entry
            );
          } else {
            // Add new entry
            return [...prevEntries, event.entry];
          }
        });
      }

      // Update the instances map as well
      setInstances((prevInstances) => {
        const newInstances = new Map(prevInstances);
        const instanceEntries = newInstances.get(event.id);
        if (instanceEntries) {
          const existingIndex = instanceEntries.findIndex(
            (entry) => entry.key === event.entry.key
          );
          if (existingIndex >= 0) {
            // Update existing entry
            const updatedEntries = instanceEntries.map((entry) =>
              entry.key === event.entry.key ? event.entry : entry
            );
            newInstances.set(event.id, updatedEntries);
          } else {
            // Add new entry
            newInstances.set(event.id, [...instanceEntries, event.entry]);
          }
        }
        return newInstances;
      });
    });

    const deleteEntrySubscription = client.onMessage(
      'delete-entry',
      (event) => {
        if (event.id === selectedInstance) {
          setEntries((prevEntries) =>
            prevEntries.filter((entry) => entry.key !== event.key)
          );
        }

        // Update the instances map as well
        setInstances((prevInstances) => {
          const newInstances = new Map(prevInstances);
          const instanceEntries = newInstances.get(event.id);
          if (instanceEntries) {
            const updatedEntries = instanceEntries.filter(
              (entry) => entry.key !== event.key
            );
            newInstances.set(event.id, updatedEntries);
          }
          return newInstances;
        });
      }
    );

    // Request initial snapshots for all instances
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

    // Update entries when selected instance changes
    const instanceEntries = instances.get(selectedInstance);
    if (instanceEntries) {
      setEntries(instanceEntries);
    } else {
      setLoading(true);
      // Request snapshot for the specific instance
      client.send('get-snapshot', {
        type: 'get-snapshot',
        id: selectedInstance,
      });
    }
  }, [client, selectedInstance, instances]);

  const filteredEntries = entries.filter((entry) =>
    entry.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleValueChange = (key: string, newValue: MMKVEntryValue) => {
    if (!client || !selectedInstance) return;

    // Determine the entry type based on the new value
    let type: 'string' | 'number' | 'boolean' | 'buffer';
    if (typeof newValue === 'string') {
      type = 'string';
    } else if (typeof newValue === 'number') {
      type = 'number';
    } else if (typeof newValue === 'boolean') {
      type = 'boolean';
    } else if (Array.isArray(newValue)) {
      type = 'buffer';
    } else {
      type = 'string'; // fallback
    }

    const updatedEntry: MMKVEntry = { key, type, value: newValue } as MMKVEntry;

    client.send('set-entry', {
      type: 'set-entry',
      id: selectedInstance,
      entry: updatedEntry,
    });

    // Optimistically update local state
    setEntries((prevEntries) =>
      prevEntries.map((entry) => (entry.key === key ? updatedEntry : entry))
    );

    // Update the instances map as well
    setInstances((prevInstances) => {
      const newInstances = new Map(prevInstances);
      const instanceEntries = newInstances.get(selectedInstance);
      if (instanceEntries) {
        const updatedEntries = instanceEntries.map((entry) =>
          entry.key === key ? updatedEntry : entry
        );
        newInstances.set(selectedInstance, updatedEntries);
      }
      return newInstances;
    });
  };

  const handleDeleteEntry = (key: string) => {
    if (!client || !selectedInstance) return;

    client.send('delete-entry', {
      type: 'delete-entry',
      id: selectedInstance,
      key,
    });

    // Optimistically update local state
    setEntries((prevEntries) =>
      prevEntries.filter((entry) => entry.key !== key)
    );

    // Update the instances map as well
    setInstances((prevInstances) => {
      const newInstances = new Map(prevInstances);
      const instanceEntries = newInstances.get(selectedInstance);
      if (instanceEntries) {
        const updatedEntries = instanceEntries.filter(
          (entry) => entry.key !== key
        );
        newInstances.set(selectedInstance, updatedEntries);
      }
      return newInstances;
    });
  };

  const handleAddEntry = (newEntry: MMKVEntry) => {
    if (!client || !selectedInstance) return;

    // Send to device
    client.send('set-entry', {
      type: 'set-entry',
      id: selectedInstance,
      entry: newEntry,
    });

    // Optimistically update local state
    setEntries((prevEntries) => [...prevEntries, newEntry]);

    // Update the instances map as well
    setInstances((prevInstances) => {
      const newInstances = new Map(prevInstances);
      const instanceEntries = newInstances.get(selectedInstance);
      if (instanceEntries) {
        newInstances.set(selectedInstance, [...instanceEntries, newEntry]);
      }
      return newInstances;
    });
  };

  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-lg">💾</span>
          <span className="text-sm font-medium text-gray-200">
            MMKV Storage
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <label htmlFor="instance-select" className="text-xs text-gray-400">
            Instance:
          </label>
          <select
            id="instance-select"
            value={selectedInstance || ''}
            onChange={(e) => setSelectedInstance(e.target.value)}
            disabled={instances.size === 0}
            className="h-8 px-2 text-xs bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {instances.size === 0 ? (
              <option>No instances found</option>
            ) : (
              Array.from(instances.keys()).map((instance) => (
                <option key={instance} value={instance}>
                  {instance}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
        <button
          onClick={() => setShowAddDialog(true)}
          disabled={!selectedInstance}
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-full pl-8 pr-3 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {filteredEntries.length} of {entries.length} entries
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {selectedInstance ? (
          <div className="flex-1 overflow-hidden">
            {filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold text-gray-200 mb-2">
                  No entries found
                </h3>
                <p className="text-gray-400 text-sm">
                  {searchTerm
                    ? 'Try adjusting your search terms'
                    : 'This instance appears to be empty'}
                </p>
              </div>
            ) : (
              <EditableTable
                data={filteredEntries}
                onValueChange={handleValueChange}
                onDeleteEntry={handleDeleteEntry}
                loading={loading}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-4">🚀</div>
            <h2 className="text-xl font-semibold text-gray-200 mb-2">
              Welcome to MMKV Inspector
            </h2>
            <p className="text-gray-400 text-sm">
              Select an MMKV instance from the dropdown above to start exploring
              your data
            </p>
          </div>
        )}
      </main>

      <AddEntryDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAddEntry={handleAddEntry}
        existingKeys={entries.map((entry) => entry.key)}
      />
    </div>
  );
}
