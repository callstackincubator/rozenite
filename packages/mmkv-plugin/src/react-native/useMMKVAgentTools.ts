import { useCallback } from 'react';
import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import type { MMKVEntry, MMKVEntryType, MMKVEntryValue } from '../shared/types';
import {
  MMKV_AGENT_PLUGIN_ID,
  mmkvToolDefinitions,
  type MMKVListEntriesArgs,
  type MMKVReadEntryArgs,
  type MMKVWriteEntryArgs,
} from '../shared/agent-tools';
import type { MMKVView } from './mmkv-view';

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
    pluginId: MMKV_AGENT_PLUGIN_ID,
    tool: mmkvToolDefinitions.listStorages,
    handler: () => ({
      storages: views.map((view) => ({
        id: view.getId(),
        entryCount: view.getAllKeys().length,
      })),
    }),
  });

  useRozenitePluginAgentTool({
    pluginId: MMKV_AGENT_PLUGIN_ID,
    tool: mmkvToolDefinitions.listEntries,
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

  useRozenitePluginAgentTool({
    pluginId: MMKV_AGENT_PLUGIN_ID,
    tool: mmkvToolDefinitions.readEntry,
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

  useRozenitePluginAgentTool({
    pluginId: MMKV_AGENT_PLUGIN_ID,
    tool: mmkvToolDefinitions.createEntry,
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
        created: true as const,
        key,
      };
    },
  });

  useRozenitePluginAgentTool({
    pluginId: MMKV_AGENT_PLUGIN_ID,
    tool: mmkvToolDefinitions.editEntry,
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
        edited: true as const,
        key,
      };
    },
  });

  useRozenitePluginAgentTool({
    pluginId: MMKV_AGENT_PLUGIN_ID,
    tool: mmkvToolDefinitions.removeEntry,
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
