import React, { useState, useEffect, useMemo } from 'react';
import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { NetworkEventMap, NetworkEntry } from '../types/network';
import styles from './panel.module.css';
import { NetworkToolbar } from './network-toolbar';
import { PanelHeader } from './components';
import { NetworkList } from './network-list';
import { NetworkDetails } from './network-details';

export default function NetworkActivityPanel() {
  const client = useRozeniteDevToolsClient<NetworkEventMap>({
    pluginId: '@rozenite/network-activity-plugin',
  });

  const [networkEntries, setNetworkEntries] = useState<Map<string, NetworkEntry>>(new Map());
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(true);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Convert Map to sorted array for rendering
  const sortedEntries = useMemo(() => {
    return Array.from(networkEntries.values())
      .sort((a, b) => b.startTime - a.startTime);
  }, [networkEntries]);

  const selectedEntry = selectedRequestId ? networkEntries.get(selectedRequestId) || null : null;

  useEffect(() => {
    if (!client) return;
    if (!isRecording) return;

    const subscriptions: Array<{ remove: () => void }> = [];

    // Subscribe to Network events
    subscriptions.push(
      client.onMessage('Network.requestWillBeSent', (payload) => {
        setNetworkEntries(prev => {
          const newMap = new Map(prev);
          newMap.set(payload.requestId, {
            requestId: payload.requestId,
            request: payload,
            status: 'pending',
            startTime: payload.timestamp,
          });
          return newMap;
        });
      })
    );

    subscriptions.push(
      client.onMessage('Network.requestWillBeSentExtraInfo', (payload) => {
        setNetworkEntries(prev => {
          const newMap = new Map(prev);
          const entry = newMap.get(payload.requestId);
          if (entry) {
            newMap.set(payload.requestId, {
              ...entry,
              extraInfo: payload,
            });
          }
          return newMap;
        });
      })
    );

    subscriptions.push(
      client.onMessage('Network.responseReceived', (payload) => {
        setNetworkEntries(prev => {
          const newMap = new Map(prev);
          const entry = newMap.get(payload.requestId);
          if (entry) {
            newMap.set(payload.requestId, {
              ...entry,
              response: payload,
              status: 'loading',
            });
          }
          return newMap;
        });
      })
    );

    subscriptions.push(
      client.onMessage('Network.loadingFinished', (payload) => {
        setNetworkEntries(prev => {
          const newMap = new Map(prev);
          const entry = newMap.get(payload.requestId);
          if (entry) {
            const endTime = payload.timestamp;
            const duration = (endTime - entry.startTime) * 1000; // Convert to milliseconds
            newMap.set(payload.requestId, {
              ...entry,
              loadingFinished: payload,
              status: 'finished',
              endTime,
              duration,
            });
          }
          return newMap;
        });
      })
    );

    subscriptions.push(
      client.onMessage('Network.loadingFailed', (payload) => {
        setNetworkEntries(prev => {
          const newMap = new Map(prev);
          const entry = newMap.get(payload.requestId);
          if (entry) {
            const endTime = payload.timestamp;
            const duration = (endTime - entry.startTime) * 1000; // Convert to milliseconds
            newMap.set(payload.requestId, {
              ...entry,
              loadingFailed: payload,
              status: 'failed',
              endTime,
              duration,
            });
          }
          return newMap;
        });
      })
    );

    return () => {
      subscriptions.forEach(sub => sub.remove());
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
    <div 
      ref={containerRef}
      className={styles.container}
    >
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
          <NetworkDetails entry={selectedEntry} />
        </div>
      </div>
    </div>
  );
}