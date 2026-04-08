import { useCallback } from 'react';
import { useRozenitePluginAgentTool, type AgentTool } from '@rozenite/agent-bridge';
import type { StorageEntry, StorageEntryType, StorageEntryValue } from '../shared/types';
import type { StorageView } from './storage-view';

type StorageInput = { adapterId?: string; storageId?: string };
type KeyInput = StorageInput & { key: string };
type SetInput = StorageInput & {
  key: string;
  type: StorageEntryType;
  value: unknown;
};
type ListEntriesInput = StorageInput & {
  offset?: number;
  limit?: number;
};

const toolPrefix = '@rozenite/storage-plugin';
const sharedStorageProperties = {
  adapterId: {
    type: 'string',
    description:
      'Storage adapter ID. Required when multiple adapters are configured.',
  },
  storageId: {
    type: 'string',
    description:
      'Storage node ID within the adapter. Required when multiple storages are configured.',
  },
} as const;

const listStoragesTool: AgentTool = {
  name: 'list-storages',
  description:
    'List all storage adapters and their storage nodes currently available on the device, including supported entry types and entry counts.',
  inputSchema: { type: 'object', properties: {} },
};

const listEntriesTool: AgentTool = {
  name: 'list-entries',
  description:
    'List keys in a storage. This call intentionally does not return entry values to keep responses token-efficient.',
  inputSchema: {
    type: 'object',
    properties: {
      ...sharedStorageProperties,
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
  description: 'Read a single storage entry value by key.',
  inputSchema: {
    type: 'object',
    properties: {
      ...sharedStorageProperties,
      key: { type: 'string', description: 'Entry key.' },
    },
    required: ['key'],
  },
};

const createEntryTool: AgentTool = {
  name: 'create-entry',
  description: 'Create a new storage entry. Fails if the key already exists.',
  inputSchema: {
    type: 'object',
    properties: {
      ...sharedStorageProperties,
      key: { type: 'string', description: 'Entry key.' },
      type: {
        type: 'string',
        enum: ['string', 'number', 'boolean', 'buffer'],
        description:
          'Entry value type. Must be one of the supported types for the target storage (see list-storages).',
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
  description: 'Edit an existing storage entry. Fails if the key does not exist.',
  inputSchema: {
    type: 'object',
    properties: {
      ...sharedStorageProperties,
      key: { type: 'string', description: 'Entry key.' },
      type: {
        type: 'string',
        enum: ['string', 'number', 'boolean', 'buffer'],
        description:
          'Entry value type. Must be one of the supported types for the target storage (see list-storages).',
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
  description: 'Remove a storage entry by key.',
  inputSchema: {
    type: 'object',
    properties: {
      ...sharedStorageProperties,
      key: { type: 'string', description: 'Entry key.' },
    },
    required: ['key'],
  },
};

const parseValueForType = (
  type: StorageEntryType,
  value: unknown
): StorageEntryValue => {
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

const formatViewRef = (view: StorageView) =>
  `${view.target.adapterId}/${view.target.storageId}`;

export const useStorageAgentTools = (views: StorageView[]) => {
  const resolveStorage = useCallback(
    (adapterId?: string, storageId?: string) => {
      if (views.length === 0) {
        throw new Error('No storages are registered.');
      }

      if (adapterId !== undefined || storageId !== undefined) {
        const selected = views.find(
          (view) =>
            (adapterId === undefined || view.target.adapterId === adapterId) &&
            (storageId === undefined || view.target.storageId === storageId)
        );

        if (!selected) {
          const qualifier = [
            adapterId && `adapterId="${adapterId}"`,
            storageId && `storageId="${storageId}"`,
          ]
            .filter(Boolean)
            .join(', ');
          throw new Error(
            `No storage matched ${qualifier}. Available: ${views.map(formatViewRef).join(', ')}`
          );
        }

        return selected;
      }

      if (views.length > 1) {
        throw new Error(
          `Multiple storages detected. Provide adapterId and/or storageId. Available: ${views.map(formatViewRef).join(', ')}`
        );
      }

      return views[0];
    },
    [views]
  );

  useRozenitePluginAgentTool({
    pluginId: toolPrefix,
    tool: listStoragesTool,
    handler: async () => ({
      storages: await Promise.all(
        views.map(async (view) => ({
          adapterId: view.target.adapterId,
          storageId: view.target.storageId,
          adapterName: view.adapterName,
          storageName: view.storageName,
          supportedTypes: view.capabilities.supportedTypes,
          entryCount: (await view.getAllKeys()).length,
        }))
      ),
    }),
  });

  useRozenitePluginAgentTool<ListEntriesInput>({
    pluginId: toolPrefix,
    tool: listEntriesTool,
    handler: async ({ adapterId, storageId, offset = 0, limit = 100 }) => {
      const view = resolveStorage(adapterId, storageId);
      const allKeys = await view.getAllKeys();
      const safeOffset = Math.max(0, Math.floor(offset));
      const safeLimit = Math.max(1, Math.floor(limit));
      const keys = allKeys.slice(safeOffset, safeOffset + safeLimit);

      return {
        adapterId: view.target.adapterId,
        storageId: view.target.storageId,
        total: allKeys.length,
        offset: safeOffset,
        limit: safeLimit,
        keys,
      };
    },
  });

  useRozenitePluginAgentTool<
    KeyInput,
    { adapterId: string; storageId: string; entry: StorageEntry }
  >({
    pluginId: toolPrefix,
    tool: readEntryTool,
    handler: async ({ adapterId, storageId, key }) => {
      const view = resolveStorage(adapterId, storageId);
      const entry = await view.get(key);

      if (!entry) {
        throw new Error(
          `Key "${key}" not found in storage "${formatViewRef(view)}".`
        );
      }

      return {
        adapterId: view.target.adapterId,
        storageId: view.target.storageId,
        entry,
      };
    },
  });

  useRozenitePluginAgentTool<SetInput>({
    pluginId: toolPrefix,
    tool: createEntryTool,
    handler: async ({ adapterId, storageId, key, type, value }) => {
      const view = resolveStorage(adapterId, storageId);
      const existing = await view.get(key);

      if (existing) {
        throw new Error(
          `Key "${key}" already exists in storage "${formatViewRef(view)}". Use edit-entry instead.`
        );
      }

      const parsedValue = parseValueForType(type, value);
      await view.set({ key, type, value: parsedValue } as StorageEntry);

      return {
        adapterId: view.target.adapterId,
        storageId: view.target.storageId,
        created: true,
        key,
      };
    },
  });

  useRozenitePluginAgentTool<SetInput>({
    pluginId: toolPrefix,
    tool: editEntryTool,
    handler: async ({ adapterId, storageId, key, type, value }) => {
      const view = resolveStorage(adapterId, storageId);
      const existing = await view.get(key);

      if (!existing) {
        throw new Error(
          `Key "${key}" not found in storage "${formatViewRef(view)}". Use create-entry instead.`
        );
      }

      const parsedValue = parseValueForType(type, value);
      await view.set({ key, type, value: parsedValue } as StorageEntry);

      return {
        adapterId: view.target.adapterId,
        storageId: view.target.storageId,
        edited: true,
        key,
      };
    },
  });

  useRozenitePluginAgentTool<KeyInput>({
    pluginId: toolPrefix,
    tool: removeEntryTool,
    handler: async ({ adapterId, storageId, key }) => {
      const view = resolveStorage(adapterId, storageId);
      const existed = !!(await view.get(key));
      await view.delete(key);

      return {
        adapterId: view.target.adapterId,
        storageId: view.target.storageId,
        removed: existed,
        key,
      };
    },
  });
};
