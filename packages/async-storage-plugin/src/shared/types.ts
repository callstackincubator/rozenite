export type AsyncStorageEntry = {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'unknown';
  parsedValue?: any;
};

export type AsyncStorageEntryType = AsyncStorageEntry['type'];
export type AsyncStorageEntryValue = AsyncStorageEntry['value'];
