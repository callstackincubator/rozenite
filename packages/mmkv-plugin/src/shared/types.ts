export type MMKVEntry =
  | { key: string; type: 'string'; value: string }
  | { key: string; type: 'number'; value: number }
  | { key: string; type: 'boolean'; value: boolean }
  | { key: string; type: 'buffer'; value: string };

export type MMKVEntryType = MMKVEntry['type'];
export type MMKVEntryValue = MMKVEntry['value'];
