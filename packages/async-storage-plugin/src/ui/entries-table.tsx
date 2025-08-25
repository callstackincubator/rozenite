import React from 'react';
import { AsyncStorageEntry } from '../shared/types';
import './entries-table.css';

interface EntriesTableProps {
  entries: AsyncStorageEntry[];
  onEditEntry: (entry: AsyncStorageEntry) => void;
  loading?: boolean;
}

export function EntriesTable({ entries, onEditEntry, loading = false }: EntriesTableProps) {
  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading entries...</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔍</div>
        <h3>No entries found</h3>
        <p>No AsyncStorage entries match your search criteria.</p>
      </div>
    );
  }

  const formatValue = (entry: AsyncStorageEntry) => {
    switch (entry.type) {
      case 'string':
        return (
          <div className="value-container value-string">
            "{entry.parsedValue || entry.value}"
          </div>
        );
      case 'number':
        return (
          <div className="value-container value-number">
            {entry.parsedValue}
          </div>
        );
      case 'boolean':
        return (
          <div className={`value-container value-boolean ${entry.parsedValue ? 'true' : 'false'}`}>
            {String(entry.parsedValue)}
          </div>
        );
      case 'object':
        return (
          <div className="value-container value-object">
            {JSON.stringify(entry.parsedValue, null, 2).substring(0, 50)}
            {JSON.stringify(entry.parsedValue, null, 2).length > 50 ? '...' : ''}
          </div>
        );
      case 'array':
        return (
          <div className="value-container value-array">
            {JSON.stringify(entry.parsedValue, null, 2).substring(0, 50)}
            {JSON.stringify(entry.parsedValue, null, 2).length > 50 ? '...' : ''}
          </div>
        );
      case 'null':
        return <div className="value-container value-null">null</div>;
      default:
        return <div className="value-container value-unknown">{entry.value}</div>;
    }
  };

  return (
    <div className="table-container">
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
            {entries.map((entry) => (
              <tr key={entry.key} className="entry-row">
                <td className="entry-key">
                  <code>{entry.key}</code>
                </td>
                <td className="entry-type">
                  <span className={`type-badge type-${entry.type}`}>
                    {entry.type}
                  </span>
                </td>
                <td 
                  className="entry-value" 
                  onClick={() => onEditEntry(entry)}
                  title="Click to edit"
                >
                  {formatValue(entry)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
