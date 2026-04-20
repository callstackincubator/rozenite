import { defineAgentToolDescriptors } from '@rozenite/agent-shared';
import {
  MMKV_AGENT_ENTRY_TYPES,
  MMKV_AGENT_PLUGIN_ID,
  mmkvToolDefinitions,
} from './src/shared/agent-tools.js';

export {
  MMKV_AGENT_ENTRY_TYPES,
  MMKV_AGENT_PLUGIN_ID,
  mmkvToolDefinitions,
};

export const mmkvTools = defineAgentToolDescriptors(
  MMKV_AGENT_PLUGIN_ID,
  mmkvToolDefinitions,
);

export type {
  MMKVCreateEntryArgs,
  MMKVCreateEntryResult,
  MMKVEditEntryArgs,
  MMKVEditEntryResult,
  MMKVListEntriesArgs,
  MMKVListEntriesResult,
  MMKVListStoragesArgs,
  MMKVListStoragesItem,
  MMKVListStoragesResult,
  MMKVReadEntryArgs,
  MMKVReadEntryResult,
  MMKVRemoveEntryArgs,
  MMKVRemoveEntryResult,
  MMKVWriteEntryArgs,
} from './src/shared/agent-tools.js';

export type {
  MMKVEntry,
  MMKVEntryType,
  MMKVEntryValue,
} from './src/shared/types.js';
