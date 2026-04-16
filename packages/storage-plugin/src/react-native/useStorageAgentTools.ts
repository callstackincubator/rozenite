import { useCallback } from 'react';
import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import {
  STORAGE_AGENT_PLUGIN_ID,
  storageToolDefinitions,
} from '../shared/agent-tools';
import type { StorageEntry, StorageEntryType, StorageEntryValue } from '../shared/types';
import type { StorageView } from './storage-view';

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
    pluginId: STORAGE_AGENT_PLUGIN_ID,
    tool: storageToolDefinitions.listStorages,
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

  useRozenitePluginAgentTool({
    pluginId: STORAGE_AGENT_PLUGIN_ID,
    tool: storageToolDefinitions.listEntries,
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

  useRozenitePluginAgentTool({
    pluginId: STORAGE_AGENT_PLUGIN_ID,
    tool: storageToolDefinitions.readEntry,
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

  useRozenitePluginAgentTool({
    pluginId: STORAGE_AGENT_PLUGIN_ID,
    tool: storageToolDefinitions.createEntry,
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
        created: true as const,
        key,
      };
    },
  });

  useRozenitePluginAgentTool({
    pluginId: STORAGE_AGENT_PLUGIN_ID,
    tool: storageToolDefinitions.editEntry,
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
        edited: true as const,
        key,
      };
    },
  });

  useRozenitePluginAgentTool({
    pluginId: STORAGE_AGENT_PLUGIN_ID,
    tool: storageToolDefinitions.removeEntry,
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
