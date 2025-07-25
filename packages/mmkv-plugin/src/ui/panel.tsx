import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useState } from 'react';
import { MMKVEventMap } from '../shared/messaging';
import { MMKVEntry, MMKVEntryValue } from '../shared/types';
import { EditableTable } from './editable-table';
import './panel.css';

export default function MMKVPanel() {
  const [instances, setInstances] = useState<string[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [entries, setEntries] = useState<MMKVEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const client = useRozeniteDevToolsClient<MMKVEventMap>({
    pluginId: '@rozenite/mmkv-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscription = client.onMessage('host-instances', (event) => {
      setInstances(event);
      if (event.length > 0 && !selectedInstance) {
        setSelectedInstance(event[0]);
      }
    });

    // Initial query for instances
    client.send('guest-get-instances', {});

    return () => {
      subscription.remove();
    };
  }, [client, selectedInstance]);

  useEffect(() => {
    if (!client || !selectedInstance) {
      return;
    }

    const entriesSubscription = client.onMessage('host-entries', (event) => {
      if (event.instanceId === selectedInstance) {
        setEntries(event.entries);
        setLoading(false);
      }
    });

    const updateSubscription = client.onMessage(
      'host-entry-updated',
      (event) => {
        if (event.instanceId === selectedInstance) {
          setEntries((prevEntries) =>
            prevEntries.map((entry) =>
              entry.key === event.key
                ? ({ ...entry, value: event.value } as MMKVEntry)
                : entry
            )
          );
        }
      }
    );

    setLoading(true);
    client.send('guest-get-entries', { instanceId: selectedInstance });

    return () => {
      entriesSubscription.remove();
      updateSubscription.remove();
    };
  }, [client, selectedInstance]);

  const filteredEntries = entries.filter((entry) =>
    entry.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleValueChange = (key: string, newValue: MMKVEntryValue) => {
    if (!client || !selectedInstance) return;

    client.send('guest-update-entry', {
      instanceId: selectedInstance,
      key,
      value: newValue,
    });

    setEntries((prevEntries) =>
      prevEntries.map((entry) =>
        entry.key === key ? ({ ...entry, value: newValue } as MMKVEntry) : entry
      )
    );
  };

  return (
    <div className="mmkv-panel">
      {/* Header */}
      <header className="panel-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">
              <span className="title-icon">💾</span>
              MMKV Storage
            </h1>
            <p className="header-subtitle">
              Inspect and manage your MMKV instances
            </p>
          </div>
          <div className="header-right">
            <div className="instance-selector">
              <label htmlFor="instance-select" className="instance-label">
                Instance
              </label>
              <select
                id="instance-select"
                value={selectedInstance || ''}
                onChange={(e) => setSelectedInstance(e.target.value)}
                disabled={instances.length === 0}
                className="instance-select"
              >
                {instances.length === 0 ? (
                  <option>No instances found</option>
                ) : (
                  instances.map((instance) => (
                    <option key={instance} value={instance}>
                      {instance}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="panel-content">
        {selectedInstance ? (
          <>
            {/* Search and Stats Bar */}
            <div className="search-section">
              <div className="search-container">
                <div className="search-input-wrapper">
                  <svg
                    className="search-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search keys..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
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

            {/* Entries Table */}
            <div className="table-container">
              {filteredEntries.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <h3>No entries found</h3>
                  <p>
                    {searchTerm
                      ? 'Try adjusting your search terms'
                      : 'This instance appears to be empty'}
                  </p>
                </div>
              ) : (
                <EditableTable
                  data={filteredEntries}
                  onValueChange={handleValueChange}
                  loading={loading}
                />
              )}
            </div>
          </>
        ) : (
          <div className="welcome-state">
            <div className="welcome-icon">🚀</div>
            <h2>Welcome to MMKV Inspector</h2>
            <p>
              Select an MMKV instance from the dropdown above to start exploring
              your data
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
