import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { NetworkEntry } from '../types/network';
import { getStatusColor, getMethodColor, formatDuration, formatFileSize, parseUrl } from './utils';
import { Badge, Tooltip } from './components';
import styles from './network-list.module.css';

interface NetworkListProps {
  entries: NetworkEntry[];
  selectedRequestId: string | null;
  onSelect: (requestId: string) => void;
  height: number;
}

const ITEM_HEIGHT = 60; // Height of each network list item

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

  const NetworkListItem: React.FC<{ entry: NetworkEntry; index: number }> = ({ entry, index }) => {
    const status = entry.response?.response.status || 0;
    const method = entry.request.request.method;
    const url = entry.request.request.url;
    const { domain, path } = parseUrl(url);
    
    // Get size information
    const encodedSize = entry.response?.response.encodedDataLength || 0;
    const decodedSize = entry.response?.response.decodedBodySize || 0;
    const displaySize = decodedSize > 0 ? decodedSize : encodedSize;

    const isSelected = selectedRequestId === entry.requestId;

    return (
      <div
        className={isSelected ? styles.listItemSelected : styles.listItem}
        onClick={() => onSelect(entry.requestId)}
      >
        <div className={styles.statusColumn}>
          <Tooltip 
            content={`Status: ${status || 'Pending'}`} 
            showOnlyWhenTruncated
            variant={status >= 400 ? 'error' : status >= 300 ? 'warning' : 'info'}
          >
            <Badge color={getStatusColor(status)}>
              {status || '...'}
            </Badge>
          </Tooltip>
        </div>
        <div className={styles.methodColumn}>
          <Tooltip 
            content={`Method: ${method}`} 
            showOnlyWhenTruncated
            variant="info"
          >
            <Badge color={getMethodColor(method)}>
              {method}
            </Badge>
          </Tooltip>
        </div>
        <div className={styles.urlColumn}>
          <Tooltip content={domain} showOnlyWhenTruncated>
            <div className={styles.domainText}>
              {domain}
            </div>
          </Tooltip>
          <Tooltip content={path} showOnlyWhenTruncated>
            <div className={styles.pathText}>
              {path}
            </div>
          </Tooltip>
          <Tooltip content={url} showOnlyWhenTruncated>
            <div className={styles.fullUrlText}>
              {url}
            </div>
          </Tooltip>
        </div>
        <div className={styles.durationColumn}>
          <Tooltip content={`Duration: ${entry.duration ? formatDuration(entry.duration) : 'Pending'}`} showOnlyWhenTruncated>
            <span className={styles.columnText}>
              {entry.duration ? formatDuration(entry.duration) : '...'}
            </span>
          </Tooltip>
        </div>
        <div className={styles.sizeColumn}>
          <Tooltip content={`Size: ${displaySize > 0 ? formatFileSize(displaySize) : 'Unknown'}`} showOnlyWhenTruncated>
            <span className={styles.columnText}>
              {displaySize > 0 ? formatFileSize(displaySize) : '...'}
            </span>
          </Tooltip>
        </div>
      </div>
    );
  };

  if (entries.length === 0) {
    return (
      <div className={styles.emptyContainer} style={{ height }}>
        <div className={styles.emptyText}>
          No network requests recorded
        </div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={styles.container}
      style={{ height }}
    >
      <div
        className={styles.virtualContainer}
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualItem: any) => (
          <div
            key={virtualItem.key}
            className={styles.virtualItem}
            style={{
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