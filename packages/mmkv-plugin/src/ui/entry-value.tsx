import type { ReactNode } from 'react';
import { parseJsonForInspection } from '@rozenite/ui';
import type { JsonInspectionParseResult } from '@rozenite/ui';
import type { MMKVEntry } from '../shared/types';

// Compact value rendering used inside the table cell.
export const renderTableValue = (entry: MMKVEntry): ReactNode => {
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
      <span
        className={`font-mono text-sm ${
          entry.value ? 'text-success' : 'text-danger'
        }`}
      >
        {entry.value ? 'true' : 'false'}
      </span>
    );
  }

  const displayValue =
    entry.value.length > 5
      ? `[${entry.value.slice(0, 5).join(', ')}, ...${
          entry.value.length - 5
        } more]`
      : `[${entry.value.join(', ')}]`;

  return <span className="font-mono text-sm text-accent">{displayValue}</span>;
};

// Full value rendering used inside the detail dialog.
export const renderDetailValue = (entry: MMKVEntry): ReactNode => {
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

  return (
    <span className="font-mono text-sm text-accent">
      [{entry.value.join(', ')}]
    </span>
  );
};

// MMKV inspects any parseable JSON (not just objects/arrays), but only when the
// parsed value is truthy.
export const getInspectableJson = (
  entry: MMKVEntry,
): JsonInspectionParseResult => {
  if (entry.type !== 'string') {
    return { ok: false, value: null };
  }

  const result = parseJsonForInspection(entry.value, 'any');
  return result.ok && Boolean(result.value)
    ? result
    : { ok: false, value: null };
};
