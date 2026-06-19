import {
  defineAgentToolContract,
  type AgentToolContract,
} from '@rozenite/agent-shared';
import type { MMKVEntry, MMKVEntryType } from './types';

type MMKVStorageSelection = {
  storageId?: string;
};

const sharedStorageProperty = {
  storageId: {
    type: 'string',
    description: 'MMKV storage ID. Required when multiple storages are configured.',
  },
} as const;

export const MMKV_AGENT_PLUGIN_ID = '@rozenite/mmkv-plugin';

export const MMKV_AGENT_ENTRY_TYPES = [
  'string',
  'number',
  'boolean',
  'buffer',
] as const satisfies readonly MMKVEntryType[];

export type MMKVListStoragesArgs = undefined;

export type MMKVListStoragesItem = {
  id: string;
  entryCount: number;
};

export type MMKVListStoragesResult = {
  storages: MMKVListStoragesItem[];
};

export type MMKVListEntriesArgs = MMKVStorageSelection & {
  offset?: number;
  limit?: number;
};

export type MMKVListEntriesResult = {
  storageId: string;
  total: number;
  offset: number;
  limit: number;
  keys: string[];
};

export type MMKVReadEntryArgs = MMKVStorageSelection & {
  key: string;
};

export type MMKVReadEntryResult = {
  storageId: string;
  entry: MMKVEntry;
};

export type MMKVWriteEntryArgs = MMKVStorageSelection & MMKVEntry;

export type MMKVCreateEntryArgs = MMKVWriteEntryArgs;

export type MMKVCreateEntryResult = {
  storageId: string;
  created: true;
  key: string;
};

export type MMKVEditEntryArgs = MMKVWriteEntryArgs;

export type MMKVEditEntryResult = {
  storageId: string;
  edited: true;
  key: string;
};

export type MMKVRemoveEntryArgs = MMKVStorageSelection & {
  key: string;
};

export type MMKVRemoveEntryResult = {
  storageId: string;
  removed: boolean;
  key: string;
};

export const mmkvToolDefinitions = {
  listStorages: defineAgentToolContract<
    MMKVListStoragesArgs,
    MMKVListStoragesResult
  >({
    name: 'list-storages',
    description: 'List MMKV storages currently available on the device.',
    inputSchema: { type: 'object', properties: {} },
  }),
  listEntries: defineAgentToolContract<
    MMKVListEntriesArgs,
    MMKVListEntriesResult
  >({
    name: 'list-entries',
    description:
      'List MMKV keys in a storage. This call intentionally does not return entry values.',
    inputSchema: {
      type: 'object',
      properties: {
        ...sharedStorageProperty,
        offset: {
          type: 'number',
          description: 'Pagination offset. Defaults to 0.',
        },
        limit: {
          type: 'number',
          description: 'Pagination size. Defaults to 100.',
        },
      },
    },
  }),
  readEntry: defineAgentToolContract<MMKVReadEntryArgs, MMKVReadEntryResult>({
    name: 'read-entry',
    description: 'Read a single MMKV entry value by key.',
    inputSchema: {
      type: 'object',
      properties: {
        ...sharedStorageProperty,
        key: { type: 'string', description: 'Entry key.' },
      },
      required: ['key'],
    },
  }),
  createEntry: defineAgentToolContract<
    MMKVCreateEntryArgs,
    MMKVCreateEntryResult
  >({
    name: 'create-entry',
    description: 'Create a new MMKV entry. Fails if the key already exists.',
    inputSchema: {
      type: 'object',
      properties: {
        ...sharedStorageProperty,
        key: { type: 'string', description: 'Entry key.' },
        type: {
          type: 'string',
          enum: [...MMKV_AGENT_ENTRY_TYPES],
          description: 'Entry value type.',
        },
        value: {
          description: 'Entry value matching the provided type.',
        },
      },
      required: ['key', 'type', 'value'],
    },
  }),
  editEntry: defineAgentToolContract<
    MMKVEditEntryArgs,
    MMKVEditEntryResult
  >({
    name: 'edit-entry',
    description: 'Edit an existing MMKV entry. Fails if the key does not exist.',
    inputSchema: {
      type: 'object',
      properties: {
        ...sharedStorageProperty,
        key: { type: 'string', description: 'Entry key.' },
        type: {
          type: 'string',
          enum: [...MMKV_AGENT_ENTRY_TYPES],
          description: 'Entry value type.',
        },
        value: {
          description: 'Entry value matching the provided type.',
        },
      },
      required: ['key', 'type', 'value'],
    },
  }),
  removeEntry: defineAgentToolContract<
    MMKVRemoveEntryArgs,
    MMKVRemoveEntryResult
  >({
    name: 'remove-entry',
    description: 'Remove an MMKV entry by key.',
    inputSchema: {
      type: 'object',
      properties: {
        ...sharedStorageProperty,
        key: { type: 'string', description: 'Entry key.' },
      },
      required: ['key'],
    },
  }),
} as const satisfies Record<string, AgentToolContract<unknown, unknown>>;
