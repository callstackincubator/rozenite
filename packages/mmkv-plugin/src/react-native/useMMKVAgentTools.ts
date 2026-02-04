import { useCallback } from 'react';
import { useRozenitePluginAgentTool, type AgentTool } from '@rozenite/agent-bridge';
import type { MMKVEntry, MMKVEntryType, MMKVEntryValue } from '../shared/types';
import type { MMKVView } from './mmkv-view';

type StorageInput = { storageId?: string };
type KeyInput = StorageInput & { key: string };
type SetInput = StorageInput & {
  key: string;
  type: MMKVEntryType;
  value: unknown;
};
type ListEntriesInput = StorageInput & {
  offset?: number;
  limit?: number;
};

const toolPrefix = '@rozenite/mmkv-plugin';
const sharedStorageProperty = {
  storageId: {
    type: 'string',
    description: 'MMKV storage ID. Required when multiple storages are configured.',
  },
} as const;

const listStoragesTool: AgentTool = {
  name: 'list-storages',
  description: 'List MMKV storages currently available on the device.',
  inputSchema: { type: 'object', properties: {} },
};

const listEntriesTool: AgentTool = {
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
};

const readEntryTool: AgentTool = {
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
};

const createEntryTool: AgentTool = {
  name: 'create-entry',
  description: 'Create a new MMKV entry. Fails if the key already exists.',
  inputSchema: {
    type: 'object',
    properties: {
      ...sharedStorageProperty,
      key: { type: 'string', description: 'Entry key.' },
      type: {
        type: 'string',
        enum: ['string', 'number', 'boolean', 'buffer'],
        description: 'Entry value type.',
      },
      value: {
        description: 'Entry value matching the provided type.',
      },
    },
    required: ['key', 'type', 'value'],
  },
};

const editEntryTool: AgentTool = {
  name: 'edit-entry',
  description: 'Edit an existing MMKV entry. Fails if the key does not exist.',
  inputSchema: {
    type: 'object',
    properties: {
      ...sharedStorageProperty,
      key: { type: 'string', description: 'Entry key.' },
      type: {
        type: 'string',
        enum: ['string', 'number', 'boolean', 'buffer'],
        description: 'Entry value type.',
      },
      value: {
        description: 'Entry value matching the provided type.',
      },
    },
    required: ['key', 'type', 'value'],
  },
};

const removeEntryTool: AgentTool = {
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
};

const parseValueForType = (
  type: MMKVEntryType,
  value: unknown
): MMKVEntryValue => {
  if (type === 'string') {
    if (typeof value !== 'string') {
      throw new Error('Expected string value for type=string');
    }
    return value;
  }

  if (type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new Error('Expected number value for type=number');
    }
    return value;
  }

  if (type === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new Error('Expected boolean value for type=boolean');
    }
    return value;
  }

  if (!Array.isArray(value) || !value.every((item) => Number.isInteger(item))) {
    throw new Error('Expected number[] value for type=buffer');
  }

  return value as number[];
};

export const useMMKVAgentTools = (views: MMKVView[]) => {
  const resolveStorage = useCallback(
    (storageId?: string) => {
      if (views.length === 0) {
        throw new Error('No MMKV storages are registered.');
      }

      if (storageId) {
        const selected = views.find((view) => view.getId() === storageId);
        if (!selected) {
          throw new Error(
            `Unknown storageId "${storageId}". Available: ${views
              .map((view) => view.getId())
              .join(', ')}`
          );
        }
        return selected;
      }

      if (views.length > 1) {
        throw new Error(
          `Multiple MMKV storages detected. Provide storageId. Available: ${views
            .map((view) => view.getId())
            .join(', ')}`
        );
      }

      return views[0];
    },
    [views]
  );

  useRozenitePluginAgentTool({
    pluginId: toolPrefix,
    tool: listStoragesTool,
    handler: () => ({
      storages: views.map((view) => ({
        id: view.getId(),
        entryCount: view.getAllKeys().length,
      })),
    }),
  });

  useRozenitePluginAgentTool<ListEntriesInput>({
    pluginId: toolPrefix,
    tool: listEntriesTool,
    handler: ({ storageId, offset = 0, limit = 100 }) => {
      const view = resolveStorage(storageId);
      const allKeys = view.getAllKeys();
      const safeOffset = Math.max(0, Math.floor(offset));
      const safeLimit = Math.max(1, Math.floor(limit));
      const keys = allKeys.slice(safeOffset, safeOffset + safeLimit);

      return {
        storageId: view.getId(),
        total: allKeys.length,
        offset: safeOffset,
        limit: safeLimit,
        keys,
      };
    },
  });

  useRozenitePluginAgentTool<KeyInput, { storageId: string; entry: MMKVEntry }>({
    pluginId: toolPrefix,
    tool: readEntryTool,
    handler: ({ storageId, key }) => {
      const view = resolveStorage(storageId);
      const entry = view.get(key);

      if (!entry) {
        throw new Error(`Key "${key}" not found in storage "${view.getId()}".`);
      }

      return {
        storageId: view.getId(),
        entry,
      };
    },
  });

  useRozenitePluginAgentTool<SetInput>({
    pluginId: toolPrefix,
    tool: createEntryTool,
    handler: ({ storageId, key, type, value }) => {
      const view = resolveStorage(storageId);
      const existing = view.get(key);
      if (existing) {
        throw new Error(
          `Key "${key}" already exists in storage "${view.getId()}". Use edit-entry instead.`
        );
      }

      const parsedValue = parseValueForType(type, value);
      view.set(key, parsedValue);

      return {
        storageId: view.getId(),
        created: true,
        key,
      };
    },
  });

  useRozenitePluginAgentTool<SetInput>({
    pluginId: toolPrefix,
    tool: editEntryTool,
    handler: ({ storageId, key, type, value }) => {
      const view = resolveStorage(storageId);
      const existing = view.get(key);
      if (!existing) {
        throw new Error(
          `Key "${key}" not found in storage "${view.getId()}". Use create-entry instead.`
        );
      }

      const parsedValue = parseValueForType(type, value);
      view.set(key, parsedValue);

      return {
        storageId: view.getId(),
        edited: true,
        key,
      };
    },
  });

  useRozenitePluginAgentTool<KeyInput>({
    pluginId: toolPrefix,
    tool: removeEntryTool,
    handler: ({ storageId, key }) => {
      const view = resolveStorage(storageId);
      const existed = !!view.get(key);
      view.delete(key);

      return {
        storageId: view.getId(),
        removed: existed,
        key,
      };
    },
  });
};
