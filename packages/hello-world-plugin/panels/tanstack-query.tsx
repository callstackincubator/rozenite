import { useCallback, useEffect, useState } from 'react';
import { Subscription, useDevToolsPluginClient } from '@rozenite/plugin-bridge';
import { parse } from 'flatted';
import { QueryCacheNotifyEvent } from '@tanstack/react-query';
import type { Query, QueryStatus } from '@tanstack/react-query';
import { padStart } from 'lodash';

export type SerializedQuery = Query & {
  _ext_isActive: boolean;
  _ext_isStale: boolean;
  _ext_observersCount: number;
};

export type ExtendedQuery = SerializedQuery & {
  key: string;
  status: QueryStatus;
  dataUpdateCount: number;
  observersCount: number;
  isQueryActive: boolean;
};

export function formatTimestamp(timestamp: number): string {
  if (timestamp === 0) {
    return '-';
  }

  const date = new Date(timestamp);

  return `${padStart(date.getHours().toString(), 2, '0')}:${padStart(
    date.getMinutes().toString(),
    2,
    '0'
  )}:${padStart(date.getSeconds().toString(), 2, '0')}.${padStart(
    date.getMilliseconds().toString(),
    3,
    '0'
  )}`;
}

export function getObserversCounter(query: SerializedQuery): number {
  return query._ext_observersCount;
}

export function isQueryActive(query: SerializedQuery): boolean {
  return query._ext_isActive;
}

function isStale(query: SerializedQuery): boolean {
  const hasStaleObserver = query._ext_isStale;
  const hasInvalidState =
    query.state.isInvalidated || !query.state.dataUpdatedAt;

  return hasStaleObserver || hasInvalidState;
}

function isInactive(query: SerializedQuery): boolean {
  return getObserversCounter(query) === 0;
}

export function getQueryStatusLabel(query: SerializedQuery): string {
  return query.state.fetchStatus === 'fetching'
    ? 'fetching'
    : isInactive(query)
    ? 'inactive'
    : query.state.fetchStatus === 'paused'
    ? 'paused'
    : isStale(query)
    ? 'stale'
    : 'fresh';
}

const extendQuery = (query: SerializedQuery): ExtendedQuery => {
  const extendedQuery = query as ExtendedQuery;
  extendedQuery.key = query.queryHash;
  extendedQuery.status = query.state.status;
  extendedQuery.dataUpdateCount = query.state.dataUpdateCount;
  extendedQuery.observersCount = getObserversCounter(query);
  extendedQuery.isQueryActive = isQueryActive(query);

  return extendedQuery;
};

// Panel components must export a React component as default
export default function TanStackQueryPanel() {
  const [queries, setQueries] = useState<ExtendedQuery[]>([]);
  const [selectedQueryId, setSelectedQueryId] = useState('');

  const upsert = useCallback((query: SerializedQuery, queryHash: string) => {
    setQueries((prevQueries) => {
      const index = prevQueries.findIndex((q) => q.queryHash === queryHash);
      if (index >= 0) {
        return [
          ...prevQueries.slice(0, index),
          extendQuery(query),
          ...prevQueries.slice(index + 1),
        ];
      } else {
        return [...prevQueries, extendQuery(query)];
      }
    });
  }, []);

  const client = useDevToolsPluginClient({
    pluginId: 'react-query',
  });

  useEffect(() => {
    const subscriptions: (Subscription | undefined)[] = [];

    subscriptions.push(
      client?.onMessage('queries', (event) => {
        // That happens onConnect only
        setSelectedQueryId('');

        const data = parse(event.queries);
        const newQueries: ExtendedQuery[] = data.map((query: ExtendedQuery) =>
          extendQuery(query)
        );
        setQueries(newQueries);
      })
    );

    subscriptions.push(
      client?.onMessage('queryCacheEvent', (event) => {
        const cacheEvent = parse(event.cacheEvent) as QueryCacheNotifyEvent;
        const {
          type,
          query: serializedQuery,
          query: { queryHash },
        } = cacheEvent;

        if (!type) {
          return;
        }

        const query = serializedQuery as SerializedQuery;

        switch (type) {
          case 'added':
            setQueries((prevQueries) => [...prevQueries, extendQuery(query)]);
            break;
          case 'removed':
            setQueries((prevQueries) =>
              prevQueries.filter((q) => q.queryHash !== queryHash)
            );
            break;
          case 'updated':
          case 'observerAdded':
          case 'observerRemoved':
          case 'observerResultsUpdated':
          case 'observerOptionsUpdated':
            upsert(query, queryHash);
            break;
          default:
            break;
        }
      })
    );

    return () => {
      for (const subscription of subscriptions) {
        subscription?.remove();
      }
    };
  }, [client]);

  return (
    <div
      style={{
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ marginBottom: '20px' }}>
        <h2
          style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '600' }}
        >
          TanStack Query DevTools
        </h2>
        <div
          style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            fontSize: '14px',
            color: '#666',
          }}
        >
          <span>Client connected: {client ? '✅ Yes' : '❌ No'}</span>
          <span>•</span>
          <span>Queries: {queries.length}</span>
        </div>
      </div>

      {queries.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#666',
            fontSize: '16px',
          }}
        >
          No queries found. Make sure your React Query client is connected.
        </div>
      ) : (
        <div style={{ overflow: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px',
              backgroundColor: 'white',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: '#f8f9fa',
                  borderBottom: '1px solid #e9ecef',
                }}
              >
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: '#495057',
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: '#495057',
                  }}
                >
                  Query Key
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: '#495057',
                  }}
                >
                  Observers
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: '#495057',
                  }}
                >
                  Updates
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: '#495057',
                  }}
                >
                  Last Updated
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: '#495057',
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {queries.map((query, index) => {
                const statusLabel = getQueryStatusLabel(query);
                const isSelected = selectedQueryId === query.queryHash;

                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'fetching':
                      return '#007bff';
                    case 'fresh':
                      return '#28a745';
                    case 'stale':
                      return '#ffc107';
                    case 'inactive':
                      return '#6c757d';
                    case 'paused':
                      return '#fd7e14';
                    default:
                      return '#6c757d';
                  }
                };

                const getStatusIcon = (status: string) => {
                  switch (status) {
                    case 'fetching':
                      return '⏳';
                    case 'fresh':
                      return '✅';
                    case 'stale':
                      return '⚠️';
                    case 'inactive':
                      return '💤';
                    case 'paused':
                      return '⏸️';
                    default:
                      return '❓';
                  }
                };

                return (
                  <tr
                    key={query.queryHash}
                    style={{
                      backgroundColor: isSelected
                        ? '#e3f2fd'
                        : index % 2 === 0
                        ? '#ffffff'
                        : '#f8f9fa',
                      borderBottom: '1px solid #e9ecef',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                    }}
                    onClick={() =>
                      setSelectedQueryId(isSelected ? '' : query.queryHash)
                    }
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isSelected
                        ? '#e3f2fd'
                        : '#f1f3f4';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isSelected
                        ? '#e3f2fd'
                        : index % 2 === 0
                        ? '#ffffff'
                        : '#f8f9fa';
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>
                          {getStatusIcon(statusLabel)}
                        </span>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: getStatusColor(statusLabel) + '20',
                            color: getStatusColor(statusLabel),
                            textTransform: 'capitalize',
                          }}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          color: '#212529',
                          wordBreak: 'break-all',
                          maxWidth: '300px',
                        }}
                      >
                        {query.queryHash}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor:
                            query.observersCount > 0 ? '#28a745' : '#6c757d',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: '600',
                        }}
                      >
                        {query.observersCount}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#e9ecef',
                          fontSize: '12px',
                          fontWeight: '500',
                          color: '#495057',
                        }}
                      >
                        {query.dataUpdateCount}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          color: '#6c757d',
                          fontFamily: 'monospace',
                        }}
                      >
                        {formatTimestamp(query.state.dataUpdatedAt)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #dee2e6',
                            borderRadius: '4px',
                            backgroundColor: 'white',
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                            e.currentTarget.style.borderColor = '#adb5bd';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.borderColor = '#dee2e6';
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Send refetch event to the React Query client
                            client?.send('queryRefetch', {
                              queryHash: query.queryHash,
                            });
                          }}
                        >
                          Refetch
                        </button>
                        <button
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #dc3545',
                            borderRadius: '4px',
                            backgroundColor: 'white',
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            color: '#dc3545',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f8d7da';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Send remove event to the React Query client
                            client?.send('queryRemove', {
                              queryHash: query.queryHash,
                            });
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedQueryId && (
        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef',
          }}
        >
          <h3
            style={{
              margin: '0 0 12px 0',
              fontSize: '16px',
              fontWeight: '600',
            }}
          >
            Query Details
          </h3>
          {(() => {
            const selectedQuery = queries.find(
              (q) => q.queryHash === selectedQueryId
            );
            if (!selectedQuery) return null;

            return (
              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Query Hash:</strong>
                  <span style={{ fontFamily: 'monospace', marginLeft: '8px' }}>
                    {selectedQuery.queryHash}
                  </span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Status:</strong>
                  <span style={{ marginLeft: '8px' }}>
                    {selectedQuery.state.status} (
                    {getQueryStatusLabel(selectedQuery)})
                  </span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Fetch Status:</strong>
                  <span style={{ marginLeft: '8px' }}>
                    {selectedQuery.state.fetchStatus}
                  </span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Observers:</strong>
                  <span style={{ marginLeft: '8px' }}>
                    {selectedQuery.observersCount}
                  </span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Data Updates:</strong>
                  <span style={{ marginLeft: '8px' }}>
                    {selectedQuery.dataUpdateCount}
                  </span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Last Updated:</strong>
                  <span style={{ marginLeft: '8px', fontFamily: 'monospace' }}>
                    {formatTimestamp(selectedQuery.state.dataUpdatedAt)}
                  </span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Last Fetched:</strong>
                  <span style={{ marginLeft: '8px', fontFamily: 'monospace' }}>
                    {formatTimestamp(selectedQuery.state.dataUpdatedAt)}
                  </span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Is Invalidated:</strong>
                  <span style={{ marginLeft: '8px' }}>
                    {selectedQuery.state.isInvalidated ? 'Yes' : 'No'}
                  </span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Is Active:</strong>
                  <span style={{ marginLeft: '8px' }}>
                    {selectedQuery.isQueryActive ? 'Yes' : 'No'}
                  </span>
                </div>
                <div
                  style={{ marginTop: '16px', display: 'flex', gap: '12px' }}
                >
                  <button
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #007bff',
                      borderRadius: '4px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#0056b3';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#007bff';
                    }}
                    onClick={() => {
                      client?.send('queryRefetch', {
                        queryHash: selectedQuery.queryHash,
                      });
                    }}
                  >
                    Refetch Query
                  </button>
                  <button
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #dc3545',
                      borderRadius: '4px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#c82333';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#dc3545';
                    }}
                    onClick={() => {
                      client?.send('queryRemove', {
                        queryHash: selectedQuery.queryHash,
                      });
                    }}
                  >
                    Remove Query
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
