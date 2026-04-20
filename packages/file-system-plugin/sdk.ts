import { defineAgentToolDescriptors } from '@rozenite/agent-shared';
import {
  FILE_SYSTEM_AGENT_PLUGIN_ID,
  fileSystemToolDefinitions,
} from './src/shared/agent-tools.js';

export {
  FILE_SYSTEM_AGENT_PLUGIN_ID,
  fileSystemToolDefinitions,
};

export const fileSystemTools = defineAgentToolDescriptors(
  FILE_SYSTEM_AGENT_PLUGIN_ID,
  fileSystemToolDefinitions,
);

export type {
  FileSystemListEntriesArgs,
  FileSystemListEntriesResult,
  FileSystemListRootsArgs,
  FileSystemListRootsResult,
  FileSystemPathArgs,
  FileSystemReadEntryArgs,
  FileSystemReadEntryResult,
  FileSystemReadFileArgs,
  FileSystemReadImageFileArgs,
  FileSystemReadImageFileResult,
  FileSystemReadTextFileArgs,
  FileSystemReadTextFileResult,
} from './src/shared/agent-tools.js';

export type {
  FileSystemProvider,
  FsEntry,
  FsRoots,
} from './src/shared/protocol.js';
