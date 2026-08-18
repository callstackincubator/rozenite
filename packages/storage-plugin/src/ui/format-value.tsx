import { cn } from '@rozenite/ui';
import type { StorageEntry } from '../shared/types';
import { compactBufferPreview } from './binary';

export const formatValue = (entry: StorageEntry) => {
  if (entry.type === 'string') {
    return <span className="font-mono text-foreground">"{entry.value}"</span>;
  }

  if (entry.type === 'number') {
    return <span className="font-mono text-foreground">{entry.value}</span>;
  }

  if (entry.type === 'boolean') {
    return (
      <span className={cn('font-mono', entry.value ? 'text-primary' : 'text-danger')}>
        {entry.value ? 'true' : 'false'}
      </span>
    );
  }

  return (
    <span className="font-mono text-muted-foreground">{compactBufferPreview(entry.value)}</span>
  );
};
