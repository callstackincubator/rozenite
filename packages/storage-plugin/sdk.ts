import { defineAgentToolDescriptors } from '@rozenite/agent-shared';
import {
  STORAGE_AGENT_ENTRY_TYPES,
  STORAGE_AGENT_PLUGIN_ID,
  storageToolDefinitions,
} from './src/shared/agent-tools.js';

export {
  STORAGE_AGENT_ENTRY_TYPES,
  STORAGE_AGENT_PLUGIN_ID,
  storageToolDefinitions,
};

export const storageTools = defineAgentToolDescriptors(
  STORAGE_AGENT_PLUGIN_ID,
  storageToolDefinitions,
);

export type {
  StorageCreateEntryArgs,
  StorageCreateEntryResult,
  StorageEditEntryArgs,
  StorageEditEntryResult,
  StorageListEntriesArgs,
  StorageListEntriesResult,
  StorageListStoragesArgs,
  StorageListStoragesItem,
  StorageListStoragesResult,
  StorageReadEntryArgs,
  StorageReadEntryResult,
  StorageRemoveEntryArgs,
  StorageRemoveEntryResult,
  StorageWriteEntryArgs,
} from './src/shared/agent-tools.js';

export type {
  StorageAdapter,
  StorageCapabilities,
  StorageEntry,
  StorageEntryType,
  StorageEntryValue,
  StorageNode,
  StorageTarget,
} from './src/shared/types.js';
