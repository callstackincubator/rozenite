import type { SerializedPerformanceEntry } from '../shared/types';

// Drives the toolbar's entryType filter (`Select`) and the waterfall/detail
// pane's Type badge. 'all' is UI-only and never appears on a real entry.
export type EntryTypeFilter = 'all' | SerializedPerformanceEntry['entryType'];

export const ENTRY_TYPE_OPTIONS: Array<{ value: EntryTypeFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'measure', label: 'Measure' },
  { value: 'metric', label: 'Metric' },
  { value: 'mark', label: 'Mark' },
  { value: 'react-native-mark', label: 'RN Mark' },
  { value: 'resource', label: 'Resource' },
];

export const ENTRY_TYPE_LABELS: Record<SerializedPerformanceEntry['entryType'], string> = {
  measure: 'Measure',
  metric: 'Metric',
  mark: 'Mark',
  'react-native-mark': 'RN Mark',
  resource: 'Resource',
};
