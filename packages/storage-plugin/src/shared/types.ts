export type StorageEntry =
  | { key: string; type: 'string'; value: string }
  | { key: string; type: 'number'; value: number }
  | { key: string; type: 'boolean'; value: boolean }
  | { key: string; type: 'buffer'; value: number[] };

export type StorageEntryType = StorageEntry['type'];
export type StorageEntryValue = StorageEntry['value'];

export type StorageCapabilities = {
  supportedTypes: StorageEntryType[];
};

export type StorageSubscription = { remove: () => void };

export type SyncStorage = {
  kind: 'sync';
  getAllKeys: () => string[];
  get: (key: string) => StorageEntry | undefined;
  set: (entry: StorageEntry) => void;
  delete: (key: string) => void;
  subscribe?: (callback: (key: string) => void) => StorageSubscription;
};

export type AsyncStorage = {
  kind: 'async';
  getAllKeys: () => Promise<readonly string[]>;
  get: (key: string) => Promise<StorageEntry | undefined>;
  set: (entry: StorageEntry) => Promise<void>;
  delete: (key: string) => Promise<void>;
  subscribe?: (callback: (key: string) => void) => StorageSubscription;
};

export type StorageNode = {
  id: string;
  name: string;
  storage: SyncStorage | AsyncStorage;
  capabilities: StorageCapabilities;
  blacklist?: RegExp;
};

export type StorageAdapter = {
  id: string;
  name: string;
  storages: StorageNode[];
};

export type StorageTarget = {
  adapterId: string;
  storageId: string;
};

export const DEFAULT_SUPPORTED_TYPES: StorageEntryType[] = [
  'string',
  'number',
  'boolean',
  'buffer',
];

export const getStorageViewId = ({ adapterId, storageId }: StorageTarget) =>
  `${adapterId}:${storageId}`;

export const supportsType = (
  capabilities: StorageCapabilities,
  type: StorageEntryType
) => capabilities.supportedTypes.includes(type);
