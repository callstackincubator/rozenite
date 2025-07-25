import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { NetworkEntry } from '../types/network';
import {
  getStatusColor,
  getMethodColor,
  formatDuration,
  formatFileSize,
  parseUrl,
} from './utils';
import { Badge, Tooltip } from './components';
import styles from './network-list.module.css';

// Enhanced network entry type to match the panel
type EnhancedNetworkEntry = NetworkEntry & {
  type?: string;
  initiator?: {
    type: string;
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  request?: {
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: string;
    hasPostData?: boolean;
  };
  response?: {
    url: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    mimeType: string;
    encodedDataLength: number;
    responseTime: number;
  };
  dataLength?: number;
};

interface NetworkListProps {
  entries: EnhancedNetworkEntry[];
  selectedRequestId: string | null;
  onSelect: (requestId: string) => void;
  height: number;
}

const ITEM_HEIGHT = 60; // Height of each network list item

const getResourceTypeColor = (type: string): string => {
  switch (type) {
    case 'Document':
      return '#4285f4';
    case 'Stylesheet':
      return '#34a853';
    case 'Script':
      return '#fbbc04';
    case 'Image':
      return '#ea4335';
    case 'Font':
      return '#9c27b0';
    case 'XHR':
      return '#ff9800';
    case 'Fetch':
      return '#2196f3';
    case 'WebSocket':
      return '#00bcd4';
    case 'Media':
      return '#e91e63';
    default:
      return '#757575';
  }
};

const getStatusDisplay = (
  entry: EnhancedNetworkEntry
): { text: string; color: string } => {
  if (entry.status === 'failed') {
    return { text: 'Failed', color: '#d32f2f' };
  }
  if (entry.status === 'pending') {
    return { text: 'Pending', color: '#ff9800' };
  }
  if (entry.status === 'loading') {
    return { text: 'Loading', color: '#2196f3' };
  }
  if (entry.status === 'finished') {
    const status = entry.response?.status || 0;
    if (status >= 400) {
      return { text: status.toString(), color: '#d32f2f' };
    }
    if (status >= 300) {
      return { text: status.toString(), color: '#ff9800' };
    }
    return { text: status.toString(), color: '#4caf50' };
  }
  return { text: '...', color: '#757575' };
};

export const NetworkList: React.FC<NetworkListProps> = ({
  entries,
  selectedRequestId,
  onSelect,
  height,
}) => {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
  });

  const NetworkListItem: React.FC<{
    entry: EnhancedNetworkEntry;
    index: number;
  }> = ({ entry, index }) => {
    const method = entry.method;
    const url = entry.url;
    const { domain, path } = parseUrl(url);
    const resourceType = entry.type || 'Other';

    // Get size information - prefer dataLength over encodedDataLength for display
    const displaySize = entry.dataLength || entry.encodedDataLength || 0;
    const statusDisplay = getStatusDisplay(entry);

    const isSelected = selectedRequestId === entry.requestId;

    return (
      <div
        className={isSelected ? styles.listItemSelected : styles.listItem}
        onClick={() => onSelect(entry.requestId)}
      >
        <div className={styles.statusColumn}>
          <Tooltip
            content={`Status: ${statusDisplay.text}`}
            showOnlyWhenTruncated
            variant={
              statusDisplay.color === '#d32f2f'
                ? 'error'
                : statusDisplay.color === '#ff9800'
                ? 'warning'
                : 'info'
            }
          >
            <Badge color={statusDisplay.color}>{statusDisplay.text}</Badge>
          </Tooltip>
        </div>
        <div className={styles.methodColumn}>
          <Tooltip
            content={`Method: ${method}`}
            showOnlyWhenTruncated
            variant="info"
          >
            <Badge color={getMethodColor(method)}>{method}</Badge>
          </Tooltip>
        </div>
        <div className={styles.urlColumn}>
          <Tooltip content={domain} showOnlyWhenTruncated>
            <div className={styles.domainText}>{domain}</div>
          </Tooltip>
          <Tooltip content={path} showOnlyWhenTruncated>
            <div className={styles.pathText}>{path}</div>
          </Tooltip>
          <Tooltip content={url} showOnlyWhenTruncated>
            <div className={styles.fullUrlText}>{url}</div>
          </Tooltip>
        </div>
        <div className={styles.typeColumn}>
          <Tooltip
            content={`Resource Type: ${resourceType}`}
            showOnlyWhenTruncated
            variant="info"
          >
            <Badge color={getResourceTypeColor(resourceType)}>
              {resourceType}
            </Badge>
          </Tooltip>
        </div>
        <div className={styles.durationColumn}>
          <Tooltip
            content={`Duration: ${
              entry.duration ? formatDuration(entry.duration) : 'Pending'
            }`}
            showOnlyWhenTruncated
          >
            <span className={styles.columnText}>
              {entry.duration ? formatDuration(entry.duration) : '...'}
            </span>
          </Tooltip>
        </div>
        <div className={styles.sizeColumn}>
          <Tooltip
            content={`Size: ${
              displaySize > 0 ? formatFileSize(displaySize) : 'Unknown'
            }`}
            showOnlyWhenTruncated
          >
            <span className={styles.columnText}>
              {displaySize > 0 ? formatFileSize(displaySize) : '...'}
            </span>
          </Tooltip>
        </div>
      </div>
    );
  };

  return (
    <div ref={parentRef} className={styles.networkList} style={{ height }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <NetworkListItem
              entry={entries[virtualItem.index]}
              index={virtualItem.index}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
