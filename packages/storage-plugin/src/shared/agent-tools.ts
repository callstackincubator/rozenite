import {
  defineAgentToolContract,
  definePaginatedAgentToolContract,
  type AgentToolContract,
} from '@rozenite/agent-shared';

import type { StorageEntry, StorageEntryType, StorageTarget } from './types';

type StorageSelection = Partial<StorageTarget>;

const sharedStorageProperties = {
  adapterId: {
    type: 'string',
    description: 'Storage adapter ID. Required when multiple adapters are configured.',
  },
  storageId: {
    type: 'string',
    description:
      'Storage node ID within the adapter. Required when multiple storages are configured.',
  },
} as const;

export const STORAGE_AGENT_PLUGIN_ID = '@rozenite/storage-plugin';

export const STORAGE_AGENT_ENTRY_TYPES = [
  'string',
  'number',
  'boolean',
  'buffer',
] as const satisfies readonly StorageEntryType[];

export type StorageListStoragesArgs = undefined;

export type StorageListStoragesItem = {
  adapterId: string;
  storageId: string;
  adapterName: string;
  storageName: string;
  supportedTypes: StorageEntryType[];
};

export type StorageListStoragesResult = {
  storages: StorageListStoragesItem[];
};

export type StorageListEntriesArgs = StorageSelection & {
  limit?: number;
  cursor?: string;
  /** @deprecated Use the opaque cursor returned by a previous page. */
  offset?: number;
};

export type StorageListEntriesResult = {
  adapterId: string;
  storageId: string;
  total: number;
  items: Array<{ key: string }>;
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
};

export type StorageReadEntryArgs = StorageSelection & {
  key: string;
};

export type StorageReadEntryResult = {
  adapterId: string;
  storageId: string;
  entry: StorageEntry;
};

export type StorageWriteEntryArgs = StorageSelection & StorageEntry;

export type StorageCreateEntryArgs = StorageWriteEntryArgs;

export type StorageCreateEntryResult = {
  adapterId: string;
  storageId: string;
  created: true;
  key: string;
};

export type StorageEditEntryArgs = StorageWriteEntryArgs;

export type StorageEditEntryResult = {
  adapterId: string;
  storageId: string;
  edited: true;
  key: string;
};

export type StorageRemoveEntryArgs = StorageSelection & {
  key: string;
};

export type StorageRemoveEntryResult = {
  adapterId: string;
  storageId: string;
  removed: boolean;
  key: string;
};

export const storageToolDefinitions = {
  listStorages: defineAgentToolContract<StorageListStoragesArgs, StorageListStoragesResult>({
    name: 'list-storages',
    description:
      'List all storage adapters and their storage nodes currently available on the device, including supported entry types. Entry counts are omitted to avoid enumerating every storage.',
    inputSchema: { type: 'object', properties: {} },
  }),
  listEntries: definePaginatedAgentToolContract<StorageListEntriesArgs, StorageListEntriesResult>({
    name: 'list-entries',
    description:
      'List keys in a storage. This call intentionally does not return entry values to keep responses token-efficient.',
    inputSchema: {
      type: 'object',
      properties: {
        ...sharedStorageProperties,
        limit: {
          type: 'number',
          description: 'Pagination size. Defaults to 20 and is capped at 100.',
        },
        cursor: {
          type: 'string',
          description: 'Opaque pagination cursor from a previous list-entries call.',
        },
        offset: {
          type: 'number',
          description:
            'Deprecated initial pagination offset. Must be a non-negative integer and cannot be combined with cursor.',
        },
      },
    },
    pagination: {
      kind: 'cursor',
      fields: ['key'],
      defaultFields: ['key'],
    },
  }),
  readEntry: defineAgentToolContract<StorageReadEntryArgs, StorageReadEntryResult>({
    name: 'read-entry',
    description: 'Read a single storage entry value by key.',
    inputSchema: {
      type: 'object',
      properties: {
        ...sharedStorageProperties,
        key: { type: 'string', description: 'Entry key.' },
      },
      required: ['key'],
    },
  }),
  createEntry: defineAgentToolContract<StorageCreateEntryArgs, StorageCreateEntryResult>({
    name: 'create-entry',
    description: 'Create a new storage entry. Fails if the key already exists.',
    inputSchema: {
      type: 'object',
      properties: {
        ...sharedStorageProperties,
        key: { type: 'string', description: 'Entry key.' },
        type: {
          type: 'string',
          enum: [...STORAGE_AGENT_ENTRY_TYPES],
          description:
            'Entry value type. Must be one of the supported types for the target storage (see list-storages).',
        },
        value: {
          description: 'Entry value matching the provided type.',
        },
      },
      required: ['key', 'type', 'value'],
    },
  }),
  editEntry: defineAgentToolContract<StorageEditEntryArgs, StorageEditEntryResult>({
    name: 'edit-entry',
    description: 'Edit an existing storage entry. Fails if the key does not exist.',
    inputSchema: {
      type: 'object',
      properties: {
        ...sharedStorageProperties,
        key: { type: 'string', description: 'Entry key.' },
        type: {
          type: 'string',
          enum: [...STORAGE_AGENT_ENTRY_TYPES],
          description:
            'Entry value type. Must be one of the supported types for the target storage (see list-storages).',
        },
        value: {
          description: 'Entry value matching the provided type.',
        },
      },
      required: ['key', 'type', 'value'],
    },
  }),
  removeEntry: defineAgentToolContract<StorageRemoveEntryArgs, StorageRemoveEntryResult>({
    name: 'remove-entry',
    description: 'Remove a storage entry by key.',
    inputSchema: {
      type: 'object',
      properties: {
        ...sharedStorageProperties,
        key: { type: 'string', description: 'Entry key.' },
      },
      required: ['key'],
    },
  }),
} as const satisfies Record<string, AgentToolContract<unknown, unknown>>;
