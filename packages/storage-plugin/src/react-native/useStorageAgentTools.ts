import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import { paginateArray } from '@rozenite/agent-shared';
import {
  STORAGE_AGENT_PLUGIN_ID,
  storageToolDefinitions,
  type StorageListEntriesArgs,
} from '../shared/agent-tools';
import {
  isReadOnly,
  type StorageEntry,
  type StorageEntryType,
  type StorageEntryValue,
} from '../shared/types';
import type { StorageView } from './storage-view';
import { compareKeys } from './entry-preview-pagination';

const parseValueForType = (type: StorageEntryType, value: unknown): StorageEntryValue => {
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

const formatViewRef = (view: StorageView) => `${view.target.adapterId}/${view.target.storageId}`;

const sanitizeOffset = (offset: number | undefined) => {
  if (
    typeof offset !== 'number' ||
    !Number.isFinite(offset) ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    return 0;
  }

  return offset;
};

const resolveStorage = (views: readonly StorageView[], adapterId?: string, storageId?: string) => {
  if (views.length === 0) {
    throw new Error('No storages are registered.');
  }

  if (adapterId !== undefined || storageId !== undefined) {
    const matches = views.filter(
      (view) =>
        (adapterId === undefined || view.target.adapterId === adapterId) &&
        (storageId === undefined || view.target.storageId === storageId),
    );
    const qualifier = [
      adapterId !== undefined && `adapterId="${adapterId}"`,
      storageId !== undefined && `storageId="${storageId}"`,
    ]
      .filter(Boolean)
      .join(', ');

    if (matches.length === 0) {
      throw new Error(
        `No storage matched ${qualifier}. Available: ${views.map(formatViewRef).join(', ')}`,
      );
    }

    if (matches.length > 1) {
      throw new Error(
        `Multiple storages matched ${qualifier}. Provide both adapterId and storageId. Available: ${matches.map(formatViewRef).join(', ')}`,
      );
    }

    return matches[0]!;
  }

  if (views.length > 1) {
    throw new Error(
      `Multiple storages detected. Provide adapterId and/or storageId. Available: ${views.map(formatViewRef).join(', ')}`,
    );
  }

  return views[0]!;
};

const listStorageKeys = async (view: StorageView, input: StorageListEntriesArgs) => {
  if (input.cursor !== undefined && input.offset !== undefined) {
    throw new Error('Provide either cursor or offset, not both.');
  }

  // A cursor resumes after a key, so the keys need an order that does not
  // change between calls: MMKV and AsyncStorage return theirs in hash order,
  // which a write can reshuffle. Sorted the way the panel sorts them.
  const rows = [...(await view.getAllKeys())].sort(compareKeys).map((key) => ({ key }));
  // `offset` is deprecated: it only picks where the first page starts. The
  // cursor of that page resumes after its last key like any other.
  const start = input.cursor === undefined ? sanitizeOffset(input.offset) : 0;

  return {
    adapterId: view.target.adapterId,
    storageId: view.target.storageId,
    total: rows.length,
    ...paginateArray(start > 0 ? rows.slice(start) : rows, {
      keyOf: (row) => row.key,
      limit: input.limit,
      cursor: input.cursor,
      scope: formatViewRef(view),
    }),
  };
};

export const createStorageAgentHandlers = (views: readonly StorageView[]) => ({
  listStorages: async () => ({
    storages: views.map((view) => ({
      adapterId: view.target.adapterId,
      storageId: view.target.storageId,
      adapterName: view.adapterName,
      storageName: view.storageName,
      supportedTypes: view.capabilities.supportedTypes,
      readOnly: isReadOnly(view.capabilities),
    })),
  }),

  listEntries: async (input: StorageListEntriesArgs) => {
    const view = resolveStorage(views, input.adapterId, input.storageId);
    return listStorageKeys(view, input);
  },

  readEntry: async ({
    adapterId,
    storageId,
    key,
  }: {
    adapterId?: string;
    storageId?: string;
    key: string;
  }) => {
    const view = resolveStorage(views, adapterId, storageId);
    const entry = await view.get(key);

    if (!entry) {
      throw new Error(`Key "${key}" not found in storage "${formatViewRef(view)}".`);
    }

    return {
      adapterId: view.target.adapterId,
      storageId: view.target.storageId,
      entry,
    };
  },
});

export const useStorageAgentTools = (views: StorageView[]) => {
  const handlers = createStorageAgentHandlers(views);

  useRozenitePluginAgentTool({
    pluginId: STORAGE_AGENT_PLUGIN_ID,
    tool: storageToolDefinitions.listStorages,
    handler: handlers.listStorages,
  });

  useRozenitePluginAgentTool({
    pluginId: STORAGE_AGENT_PLUGIN_ID,
    tool: storageToolDefinitions.listEntries,
    handler: handlers.listEntries,
  });

  useRozenitePluginAgentTool({
    pluginId: STORAGE_AGENT_PLUGIN_ID,
    tool: storageToolDefinitions.readEntry,
    handler: handlers.readEntry,
  });

  useRozenitePluginAgentTool({
    pluginId: STORAGE_AGENT_PLUGIN_ID,
    tool: storageToolDefinitions.createEntry,
    handler: async ({ adapterId, storageId, key, type, value }) => {
      const view = resolveStorage(views, adapterId, storageId);
      const existing = await view.get(key);

      if (existing) {
        throw new Error(
          `Key "${key}" already exists in storage "${formatViewRef(view)}". Use edit-entry instead.`,
        );
      }

      const parsedValue = parseValueForType(type, value);
      await view.set({ key, type, value: parsedValue } as StorageEntry);

      return {
        adapterId: view.target.adapterId,
        storageId: view.target.storageId,
        created: true as const,
        key,
      };
    },
  });

  useRozenitePluginAgentTool({
    pluginId: STORAGE_AGENT_PLUGIN_ID,
    tool: storageToolDefinitions.editEntry,
    handler: async ({ adapterId, storageId, key, type, value }) => {
      const view = resolveStorage(views, adapterId, storageId);
      const existing = await view.get(key);

      if (!existing) {
        throw new Error(
          `Key "${key}" not found in storage "${formatViewRef(view)}". Use create-entry instead.`,
        );
      }

      const parsedValue = parseValueForType(type, value);
      await view.set({ key, type, value: parsedValue } as StorageEntry);

      return {
        adapterId: view.target.adapterId,
        storageId: view.target.storageId,
        edited: true as const,
        key,
      };
    },
  });

  useRozenitePluginAgentTool({
    pluginId: STORAGE_AGENT_PLUGIN_ID,
    tool: storageToolDefinitions.removeEntry,
    handler: async ({ adapterId, storageId, key }) => {
      const view = resolveStorage(views, adapterId, storageId);
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
