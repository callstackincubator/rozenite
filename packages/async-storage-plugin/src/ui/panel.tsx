import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useState } from 'react';
import { AsyncStorageEventMap } from '../shared/messaging';
import { AsyncStorageEntry } from '../shared/types';
import { EntriesTable } from './entries-table';
import { EditModal } from './edit-modal';
import { AddEntryModal } from './add-entry-modal';
import './panel.css';
import './states.css';

export default function AsyncStoragePanel() {
  const [entries, setEntries] = useState<AsyncStorageEntry[]>([]);
  const [allKeys, setAllKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingEntry, setEditingEntry] = useState<AsyncStorageEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  const client = useRozeniteDevToolsClient<AsyncStorageEventMap>({
    pluginId: '@rozenite/async-storage-plugin',
  });

  // Initialize - get all keys and entries
  useEffect(() => {
    if (!client) return;

    const allKeysSubscription = client.onMessage('host-all-keys', (keys) => {
      setAllKeys(keys);
      
      if (keys.length > 0 && entries.length === 0) {
        // Request entries for these keys
        client.send('guest-get-entries', { keys });
      } else if (keys.length === 0) {
        // If no keys, clear entries and stop loading
        setEntries([]);
        setLoading(false);
      }
    });

    const entriesSubscription = client.onMessage('host-entries', (newEntries) => {
      setEntries(newEntries);
      setLoading(false);
    });

    const entryUpdatedSubscription = client.onMessage('host-entry-updated', (updatedEntry) => {
      setEntries((prevEntries) => {
        const index = prevEntries.findIndex(entry => entry.key === updatedEntry.key);
        if (index !== -1) {
          // Entry exists, update it
          const newEntries = [...prevEntries];
          newEntries[index] = {
            ...newEntries[index],
            value: updatedEntry.value,
            // We'll need to re-detect the type and re-parse
            // In a full implementation, the host would send this
          };
          return newEntries;
        } else {
          // New entry, append it
          // In a full implementation, we'd get the entry type from the host
          return [...prevEntries, {
            key: updatedEntry.key,
            value: updatedEntry.value,
            type: 'string'
          }];
        }
      });
    });

    // Initial request for keys
    client.send('guest-get-all-keys', {});

    return () => {
      allKeysSubscription.remove();
      entriesSubscription.remove();
      entryUpdatedSubscription.remove();
    };
  }, [client, entries.length]);

  // Filter entries based on search term
  const filteredEntries = searchTerm
    ? entries.filter((entry) =>
        entry.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.value.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : entries;

  // Handle editing an entry
  const handleEditEntry = (entry: AsyncStorageEntry) => {
    setEditingEntry(entry);
    setIsEditModalOpen(true);
  };

  // Handle saving an edited entry
  const handleSaveEntry = (key: string, newValue: string) => {
    if (!client) return;

    client.send('guest-update-entry', {
      key,
      value: newValue
    });
  };

  // Handle deleting an entry
  const handleDeleteEntry = (key: string) => {
    if (!client) return;

    client.send('guest-remove-entry', { key });
  };

  // Handle adding a new entry
  const handleAddEntry = (key: string, value: string) => {
    if (!client) return;

    client.send('guest-update-entry', {
      key,
      value
    });
  };

  // Handle clearing all entries
  const handleClearAll = () => {
    if (!client) return;

    if (window.confirm('Are you sure you want to clear all AsyncStorage data? This cannot be undone.')) {
      client.send('guest-clear-all', {});
      setLoading(true);
    }
  };

  // Handle refreshing entries
  const handleRefresh = () => {
    if (!client) return;

    setLoading(true);
    client.send('guest-get-all-keys', {});
    client.send('guest-get-entries', {});
  };

  return (
    <div className="async-storage-panel">
      <header className="panel-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">
              <span className="title-icon">💾</span>
              AsyncStorage
            </h1>
            <p className="header-subtitle">
              Inspect and manage your AsyncStorage data
            </p>
          </div>
          <div className="header-right">
            <div className="actions-bar">
              <button 
                className="action-button" 
                onClick={() => setIsAddModalOpen(true)}
                disabled={loading}
              >
                Add Entry
              </button>
              <button 
                className="action-button" 
                onClick={handleRefresh}
                disabled={loading}
              >
                Refresh
              </button>
              <button 
                className="action-button danger" 
                onClick={handleClearAll}
                disabled={loading || entries.length === 0}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="panel-content">
        <div className="search-section">
          <div className="search-container">
            <div className="search-input-wrapper">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search keys and values..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
                disabled={loading}
              />
            </div>
            <div className="stats-badge">
              <span className="stats-count">{filteredEntries.length}</span>
              <span className="stats-label">
                of {entries.length} entries
              </span>
            </div>
          </div>
        </div>

        {entries.length === 0 && !loading ? (
          <div className="welcome-state">
            <div className="welcome-icon">📱</div>
            <h2>No AsyncStorage Data Found</h2>
            <p>
              Your app doesn't have any AsyncStorage entries yet, or the React Native connection hasn't been established.
            </p>
          </div>
        ) : (
          <EntriesTable
            entries={filteredEntries}
            onEditEntry={handleEditEntry}
            loading={loading}
          />
        )}
      </main>

      {/* Edit Modal */}
      <EditModal
        isOpen={isEditModalOpen}
        entry={editingEntry}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
      />

      {/* Add Modal */}
      <AddEntryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddEntry}
        existingKeys={allKeys}
      />
    </div>
  );
}
