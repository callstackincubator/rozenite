import {
  defineAgentToolContract,
  type AgentToolContract,
} from '@rozenite/agent-shared';
import type {
  FileSystemProvider,
  FsEntry,
  FsRoots,
} from './protocol';

export const FILE_SYSTEM_AGENT_PLUGIN_ID = '@rozenite/file-system-plugin';

export type FileSystemPathArgs = {
  path: string;
};

export type FileSystemReadFileArgs = FileSystemPathArgs & {
  maxBytes?: number;
};

export type FileSystemListRootsArgs = undefined;

export type FileSystemListRootsResult = FsRoots;

export type FileSystemListEntriesArgs = FileSystemPathArgs & {
  offset?: number;
  limit?: number;
};

export type FileSystemListEntriesResult = {
  provider: FileSystemProvider;
  path: string;
  total: number;
  offset: number;
  limit: number;
  entries: FsEntry[];
};

export type FileSystemReadEntryArgs = FileSystemPathArgs;

export type FileSystemReadEntryResult = {
  provider: FileSystemProvider;
  path: string;
  entry: FsEntry;
};

export type FileSystemReadTextFileArgs = FileSystemReadFileArgs;

export type FileSystemReadTextFileResult = {
  provider: FileSystemProvider;
  path: string;
  mimeTypeHint: string | null;
  size: number | null;
  content: string;
};

export type FileSystemReadImageFileArgs = FileSystemReadFileArgs;

export type FileSystemReadImageFileResult = {
  provider: FileSystemProvider;
  path: string;
  mimeTypeHint: string | null;
  size: number | null;
  dataUri: string;
};

export type FileSystemAgentTransferAttribution = {
  triggeredBy: 'agent';
  pluginId: typeof FILE_SYSTEM_AGENT_PLUGIN_ID;
  operation: 'export-file' | 'import-file';
};

export type FileSystemExportFileArgs = FileSystemPathArgs;

export type FileSystemExportFileResult = {
  provider: FileSystemProvider;
  path: string;
  fileName: string;
  mime: string;
  size: number | null;
  base64: string;
  attribution: FileSystemAgentTransferAttribution;
};

export type FileSystemImportFileArgs = {
  directoryPath: string;
  fileName: string;
  base64: string;
  overwrite?: boolean;
};

export type FileSystemImportFileResult = {
  provider: FileSystemProvider;
  directoryPath: string;
  path?: string;
  entry?: FsEntry;
  overwriteRequired?: boolean;
  attribution: FileSystemAgentTransferAttribution;
};

export const fileSystemToolDefinitions = {
  listRoots: defineAgentToolContract<
    FileSystemListRootsArgs,
    FileSystemListRootsResult
  >({
    name: 'list-roots',
    description:
      'List the filesystem roots currently available on the device and report which provider is active.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  }),
  listEntries: defineAgentToolContract<
    FileSystemListEntriesArgs,
    FileSystemListEntriesResult
  >({
    name: 'list-entries',
    description:
      'List entries in a directory path without returning file contents. Use this before reading a file preview.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or provider-root-qualified directory path.',
        },
        offset: {
          type: 'number',
          description: 'Pagination offset. Defaults to 0.',
        },
        limit: {
          type: 'number',
          description: 'Pagination size. Defaults to 100.',
        },
      },
      required: ['path'],
    },
  }),
  readEntry: defineAgentToolContract<
    FileSystemReadEntryArgs,
    FileSystemReadEntryResult
  >({
    name: 'read-entry',
    description:
      'Read metadata for a single filesystem path. Returns file or directory metadata, but not file contents.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Absolute or provider-root-qualified file or directory path.',
        },
      },
      required: ['path'],
    },
  }),
  readTextFile: defineAgentToolContract<
    FileSystemReadTextFileArgs,
    FileSystemReadTextFileResult
  >({
    name: 'read-text-file',
    description:
      'Read a text-style preview for a file path. Non-text files fall back to a hex-style binary preview.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or provider-root-qualified file path.',
        },
        maxBytes: {
          type: 'number',
          description: 'Maximum preview size in bytes. Defaults to 10000000.',
        },
      },
      required: ['path'],
    },
  }),
  readImageFile: defineAgentToolContract<
    FileSystemReadImageFileArgs,
    FileSystemReadImageFileResult
  >({
    name: 'read-image-file',
    description:
      'Read an image preview for a file path and return it as a data URI.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or provider-root-qualified image file path.',
        },
        maxBytes: {
          type: 'number',
          description: 'Maximum preview size in bytes. Defaults to 10000000.',
        },
      },
      required: ['path'],
    },
  }),
  exportFile: defineAgentToolContract<
    FileSystemExportFileArgs,
    FileSystemExportFileResult
  >({
    name: 'export-file',
    description:
      'Agent-triggered raw file export. Reads a single file under a configured filesystem root and returns exact base64 contents. This tool is registered only when agent export is explicitly enabled.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or provider-root-qualified file path.',
        },
      },
      required: ['path'],
    },
  }),
  importFile: defineAgentToolContract<
    FileSystemImportFileArgs,
    FileSystemImportFileResult
  >({
    name: 'import-file',
    description:
      'Agent-triggered raw file import. Writes a single base64-encoded file into an existing directory under a configured filesystem root. This tool is registered only when agent import is explicitly enabled.',
    inputSchema: {
      type: 'object',
      properties: {
        directoryPath: {
          type: 'string',
          description:
            'Absolute or provider-root-qualified existing directory path.',
        },
        fileName: {
          type: 'string',
          description:
            'Destination file name only. Path separators and traversal are rejected.',
        },
        base64: {
          type: 'string',
          description: 'Exact file contents encoded as base64.',
        },
        overwrite: {
          type: 'boolean',
          description:
            'Set to true to overwrite an existing destination file after an overwriteRequired response.',
        },
      },
      required: ['directoryPath', 'fileName', 'base64'],
    },
  }),
} as const satisfies Record<string, AgentToolContract<unknown, unknown>>;
