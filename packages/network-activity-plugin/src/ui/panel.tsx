import React, { useState, useEffect, useMemo } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  NetworkActivityEventMap,
  NetworkRequestId,
  NetworkResourceType,
} from '../types/client';
import { NetworkEntry } from '../types/network';
import styles from './panel.module.css';
import { NetworkToolbar } from './network-toolbar';
import { PanelHeader } from './components';
import { NetworkList } from './network-list';
import { NetworkDetails } from './network-details';

// Enhanced network entry with CDP data
type EnhancedNetworkEntry = NetworkEntry & {
  // CDP specific fields
  loaderId?: string;
  documentURL?: string;
  type?: NetworkResourceType;
  initiator?: {
    type: string;
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  // Request details
  request?: {
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: string;
    hasPostData?: boolean;
  };
  // Response details
  response?: {
    url: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    mimeType: string;
    encodedDataLength: number;
    responseTime: number;
  };
  // Response body
  responseBody?: {
    body: string;
    base64Encoded: boolean;
  };
  // Timing and data
  dataLength?: number;
  // Error details
  blockedReason?: string;
  corsErrorStatus?: any;
};

export default function NetworkActivityPanel() {
  const client = useRozeniteDevToolsClient<NetworkActivityEventMap>({
    pluginId: '@rozenite/network-activity-plugin',
  });

  const [networkEntries, setNetworkEntries] = useState<
    Map<string, EnhancedNetworkEntry>
  >(new Map());
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null
  );
  const [isRecording, setIsRecording] = useState(true);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Convert Map to sorted array for rendering
  const sortedEntries = useMemo(() => {
    return Array.from(networkEntries.values()).sort(
      (a, b) => b.startTime - a.startTime
    );
  }, [networkEntries]);

  const selectedEntry = selectedRequestId
    ? networkEntries.get(selectedRequestId) || null
    : null;

  useEffect(() => {
    if (!client) {
      return;
    }

    if (isRecording) {
      client.send('network-enable', {});
      console.log('enabling!');
    } else {
      client.send('network-disable', {});
    }
  }, [client, isRecording]);

  useEffect(() => {
    if (!client) return;

    const subscriptions: Array<{ remove: () => void }> = [];

    // Subscribe to CDP Network events
    subscriptions.push(
      client.onMessage('Network.requestWillBeSent', (payload) => {
        setNetworkEntries((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(payload.requestId);

          newMap.set(payload.requestId, {
            requestId: payload.requestId,
            loaderId: payload.loaderId,
            documentURL: payload.documentURL,
            url: payload.request.url,
            method: payload.request.method,
            headers: payload.request.headers,
            postData: payload.request.postData,
            hasPostData: payload.request.hasPostData,
            status: 'pending',
            startTime: payload.timestamp,
            type: payload.type,
            initiator: payload.initiator,
            request: payload.request,
            // Preserve existing response data if this is a redirect
            ...(existing && {
              response: existing.response,
              status: existing.status,
              endTime: existing.endTime,
              duration: existing.duration,
              encodedDataLength: existing.encodedDataLength,
              dataLength: existing.dataLength,
              errorText: existing.errorText,
              canceled: existing.canceled,
            }),
          });
          return newMap;
        });
      })
    );

    subscriptions.push(
      client.onMessage('Network.responseReceived', (payload) => {
        setNetworkEntries((prev) => {
          const newMap = new Map(prev);
          const entry = newMap.get(payload.requestId);
          if (entry) {
            newMap.set(payload.requestId, {
              ...entry,
              response: payload.response,
              status: 'loading',
            });
          }
          return newMap;
        });
      })
    );

    subscriptions.push(
      client.onMessage('Network.dataReceived', (payload) => {
        setNetworkEntries((prev) => {
          const newMap = new Map(prev);
          const entry = newMap.get(payload.requestId);
          if (entry) {
            newMap.set(payload.requestId, {
              ...entry,
              dataLength: payload.dataLength,
              encodedDataLength: payload.encodedDataLength,
            });
          }
          return newMap;
        });
      })
    );

    subscriptions.push(
      client.onMessage('Network.loadingFinished', (payload) => {
        setNetworkEntries((prev) => {
          const newMap = new Map(prev);
          const entry = newMap.get(payload.requestId);
          if (entry) {
            const endTime = payload.timestamp;
            const duration = endTime - entry.startTime;

            newMap.set(payload.requestId, {
              ...entry,
              status: 'finished',
              endTime,
              duration,
              encodedDataLength: payload.encodedDataLength,
            });
          }
          return newMap;
        });
      })
    );

    subscriptions.push(
      client.onMessage('Network.loadingFailed', (payload) => {
        setNetworkEntries((prev) => {
          const newMap = new Map(prev);
          const entry = newMap.get(payload.requestId);
          if (entry) {
            const endTime = payload.timestamp;
            const duration = endTime - entry.startTime;

            newMap.set(payload.requestId, {
              ...entry,
              status: 'failed',
              endTime,
              duration,
              errorText: payload.errorText,
              canceled: payload.canceled,
            });
          }
          return newMap;
        });
      })
    );

    subscriptions.push(
      client.onMessage('Network.responseBodyReceived', (payload) => {
        setNetworkEntries((prev) => {
          const newMap = new Map(prev);
          const entry = newMap.get(payload.requestId);
          if (entry) {
            newMap.set(payload.requestId, {
              ...entry,
              responseBody: {
                body: payload.body,
                base64Encoded: payload.base64Encoded,
              },
            });
          }
          return newMap;
        });
      })
    );

    return () => {
      subscriptions.forEach((sub) => sub.remove());
    };
  }, [client, isRecording]);

  const clearNetworkLog = () => {
    setNetworkEntries(new Map());
    setSelectedRequestId(null);
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  const handleSelectRequest = (requestId: string) => {
    setSelectedRequestId(requestId);
  };

  const requestResponseBody = (requestId: string) => {
    if (client) {
      client.send('Network.getResponseBody', { requestId });
    }
  };

  // Update container height on mount and resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerHeight(rect.height - 120); // Subtract toolbar and header height
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  return (
    <div ref={containerRef} className={styles.container}>
      {/* Toolbar */}
      <NetworkToolbar
        isRecording={isRecording}
        onToggleRecording={toggleRecording}
        onClear={clearNetworkLog}
        requestCount={sortedEntries.length}
      />

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Network List */}
        <div className={styles.networkListContainer}>
          {/* List Header */}
          <PanelHeader>
            <div className={styles.headerStatus}>Status</div>
            <div className={styles.headerMethod}>Method</div>
            <div className={styles.headerName}>Name</div>
            <div className={styles.headerType}>Type</div>
            <div className={styles.headerTime}>Time</div>
            <div className={styles.headerSize}>Size</div>
          </PanelHeader>

          <div className={styles.listContent}>
            <NetworkList
              entries={sortedEntries}
              selectedRequestId={selectedRequestId}
              onSelect={handleSelectRequest}
              height={containerHeight}
            />
          </div>
        </div>

        {/* Details Panel */}
        <div className={styles.detailsContainer}>
          <NetworkDetails
            entry={selectedEntry}
            onRequestResponseBody={requestResponseBody}
          />
        </div>
      </div>
    </div>
  );
}
