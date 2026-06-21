import type { ReactNode } from 'react';
import type { StorageEntry } from '../shared/types';
import { bytesToHexdump, compactBufferPreview } from './binary';

// Compact value rendering used inside the table cell.
export const renderTableValue = (entry: StorageEntry): ReactNode => {
  if (entry.type === 'string') {
    return (
      <span className="font-mono text-sm text-success">"{entry.value}"</span>
    );
  }

  if (entry.type === 'number') {
    return (
      <span className="font-mono text-sm text-foreground">{entry.value}</span>
    );
  }

  if (entry.type === 'boolean') {
    return (
      <span className={'font-mono text-sm text-warning'}>
        {entry.value ? 'true' : 'false'}
      </span>
    );
  }

  return (
    <span className="font-mono text-sm text-accent">
      {compactBufferPreview(entry.value)}
    </span>
  );
};

// Full value rendering used inside the detail dialog (buffers as a hexdump).
export const renderDetailValue = (entry: StorageEntry): ReactNode => {
  if (entry.type === 'string') {
    return (
      <span className="break-all font-mono text-sm text-success">
        "{entry.value}"
      </span>
    );
  }

  if (entry.type === 'number') {
    return (
      <span className="font-mono text-sm text-foreground">{entry.value}</span>
    );
  }

  if (entry.type === 'boolean') {
    return (
      <span
        className={`font-mono text-sm ${
          entry.value ? 'text-success' : 'text-danger'
        }`}
      >
        {entry.value ? 'true' : 'false'}
      </span>
    );
  }

  const bufferArray = entry.value as number[];
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted">
        {bufferArray.length} {bufferArray.length === 1 ? 'byte' : 'bytes'}
      </div>
      <pre className="font-mono text-xs text-accent whitespace-pre overflow-auto leading-snug">
        {bytesToHexdump(bufferArray)}
      </pre>
    </div>
  );
};
