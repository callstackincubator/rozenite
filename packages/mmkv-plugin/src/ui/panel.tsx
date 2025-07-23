import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { useEffect, useState } from "react";
import { MMKVEventMap, MMKVEntry } from "../shared/network";
import "./panel.css";

export default function MMKVPanel() {
  const [instances, setInstances] = useState<string[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [entries, setEntries] = useState<MMKVEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const client = useRozeniteDevToolsClient<MMKVEventMap>({
    pluginId: '@rozenite/mmkv-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    client.send('get-instances', {});
    
    const subscription = client.onMessage('instances', (event) => {
      setInstances(event);
      if (event.length > 0 && !selectedInstance) {
        setSelectedInstance(event[0]);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [client, selectedInstance]);

  useEffect(() => {
    if (!client || !selectedInstance) {
      return;
    }

    setLoading(true);
    client.send('get-entries', { instanceId: selectedInstance });
    
    const subscription = client.onMessage('entries', (event) => {
      if (event.instanceId === selectedInstance) {
        setEntries(event.entries);
        setLoading(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [client, selectedInstance]);

  const filteredEntries = entries.filter(entry =>
    entry.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatValue = (entry: MMKVEntry) => {
    switch (entry.type) {
      case 'string':
        return (
          <span className="value-string">
            "{entry.value as string}"
          </span>
        );
      case 'number':
        return (
          <span className="value-number">
            {entry.value as number}
          </span>
        );
      case 'boolean':
        return (
          <span className={`value-boolean ${entry.value ? 'true' : 'false'}`}>
            {entry.value ? 'true' : 'false'}
          </span>
        );
      case 'buffer':
        return (
          <span className="value-buffer">
            [Buffer: {(entry.value as string).substring(0, 20)}...]
          </span>
        );
      default:
        return <span className="value-unknown">{String(entry.value)}</span>;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string': return '#10b981';
      case 'number': return '#3b82f6';
      case 'boolean': return '#f59e0b';
      case 'buffer': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'string': return '📝';
      case 'number': return '🔢';
      case 'boolean': return '✅';
      case 'buffer': return '💾';
      default: return '❓';
    }
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
            <p className="header-subtitle">Inspect and manage your MMKV instances</p>
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
                  <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
                  <span className="stats-label">of {entries.length} entries</span>
                </div>
              </div>
            </div>

            {/* Entries Table */}
            <div className="table-container">
              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Loading entries...</p>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <h3>No entries found</h3>
                  <p>{searchTerm ? 'Try adjusting your search terms' : 'This instance appears to be empty'}</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="entries-table">
                    <thead>
                      <tr>
                        <th className="th-key">Key</th>
                        <th className="th-type">Type</th>
                        <th className="th-value">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry) => (
                        <tr key={entry.key} className="entry-row">
                          <td className="entry-key">
                            <code>{entry.key}</code>
                          </td>
                          <td className="entry-type">
                            <span 
                              className="type-badge"
                              style={{ backgroundColor: getTypeColor(entry.type) }}
                              title={`${getTypeIcon(entry.type)} ${entry.type}`}
                            >
                              {entry.type}
                            </span>
                          </td>
                          <td className="entry-value">
                            {formatValue(entry)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="welcome-state">
            <div className="welcome-icon">🚀</div>
            <h2>Welcome to MMKV Inspector</h2>
            <p>Select an MMKV instance from the dropdown above to start exploring your data</p>
          </div>
        )}
      </main>
    </div>
  );
}