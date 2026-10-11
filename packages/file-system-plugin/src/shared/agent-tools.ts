import { defineAgentToolContract, type AgentToolContract } from '@rozenite/agent-shared';
import type { FileSystemProvider, FsEntry, FsRoots } from './protocol';

export const FILE_SYSTEM_AGENT_PLUGIN_ID = '@rozenite/file-system-plugin';

export type FileSystemPathArgs = {
  path: string;
};

export type FileSystemReadFileArgs = FileSystemPathArgs & {
  maxBytes?: number;
};

/** Largest `maxBytes` read-text-file accepts (10 MB). */
export const FILE_SYSTEM_MAX_TEXT_BYTES = 10_000_000;
/** Default `maxBytes` of read-text-file. */
export const FILE_SYSTEM_DEFAULT_TEXT_BYTES = 16_384;
/** Default `maxBytes` of read-image-file with `inline: true`. */
export const FILE_SYSTEM_DEFAULT_INLINE_IMAGE_BYTES = 262_144;
/** Default `maxBytes` of export-file. */
export const FILE_SYSTEM_DEFAULT_EXPORT_BYTES = 1_048_576;

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

export type FileSystemReadTextFileArgs = FileSystemReadFileArgs & {
  /** Byte offset to start reading from. Defaults to 0. */
  offset?: number;
};

export type FileSystemReadTextFileResult = {
  provider: FileSystemProvider;
  path: string;
  mimeTypeHint: string | null;
  size: number | null;
  /** The text between `offset` and `offset + maxBytes`. */
  content: string;
  /** Byte offset of the first byte of `content`. */
  offset: number;
  /** Size in bytes of the whole text the provider read. */
  totalBytes: number;
  /** Whether bytes after `content` were left out. */
  truncated: boolean;
};

export type FileSystemReadImageFileArgs = FileSystemReadFileArgs & {
  /** Return the image as a data URI. Without it only metadata is returned. */
  inline?: boolean;
};

export type FileSystemReadImageFileResult = {
  provider: FileSystemProvider;
  path: string;
  mimeTypeHint: string | null;
  size: number | null;
  /** Present only with `inline: true`. */
  dataUri?: string;
};

export type FileSystemAgentTransferAttribution = {
  triggeredBy: 'agent';
  pluginId: typeof FILE_SYSTEM_AGENT_PLUGIN_ID;
  operation: 'export-file' | 'import-file';
};

export type FileSystemExportFileArgs = FileSystemPathArgs & {
  /** Largest file, in bytes, the export returns. Defaults to 1048576. */
  maxBytes?: number;
};

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
  listRoots: defineAgentToolContract<FileSystemListRootsArgs, FileSystemListRootsResult>({
    name: 'list-roots',
    description:
      'List the filesystem roots currently available on the device and report which provider is active.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  }),
  listEntries: defineAgentToolContract<FileSystemListEntriesArgs, FileSystemListEntriesResult>({
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
  readEntry: defineAgentToolContract<FileSystemReadEntryArgs, FileSystemReadEntryResult>({
    name: 'read-entry',
    description:
      'Read metadata for a single filesystem path. Returns file or directory metadata, but not file contents.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or provider-root-qualified file or directory path.',
        },
      },
      required: ['path'],
    },
  }),
  readTextFile: defineAgentToolContract<FileSystemReadTextFileArgs, FileSystemReadTextFileResult>({
    name: 'read-text-file',
    description:
      'Read a text-style preview for a file path, up to maxBytes (16384 by default) starting at offset. The result reports totalBytes and truncated. Non-text files fall back to a hex-style binary preview.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or provider-root-qualified file path.',
        },
        offset: {
          type: 'integer',
          description:
            'Byte offset to start reading from. Defaults to 0. Pass the previous offset plus maxBytes to read the next range.',
        },
        maxBytes: {
          type: 'integer',
          description: 'Maximum number of bytes to return. Defaults to 16384, max 10000000.',
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
      'Read image metadata (path, mimeTypeHint, size) for a file path. Pass inline: true to also return the image as a data URI.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or provider-root-qualified image file path.',
        },
        inline: {
          type: 'boolean',
          description: 'Also return the image as a base64 data URI. Defaults to false.',
        },
        maxBytes: {
          type: 'integer',
          description:
            'Largest image, in bytes, returned inline. Larger images fail. Defaults to 262144, max 10000000.',
        },
      },
      required: ['path'],
    },
  }),
  exportFile: defineAgentToolContract<FileSystemExportFileArgs, FileSystemExportFileResult>({
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
        maxBytes: {
          type: 'integer',
          description: 'Largest file, in bytes, to export. Larger files fail. Defaults to 1048576.',
        },
      },
      required: ['path'],
    },
  }),
  importFile: defineAgentToolContract<FileSystemImportFileArgs, FileSystemImportFileResult>({
    name: 'import-file',
    description:
      'Agent-triggered raw file import. Writes a single base64-encoded file into an existing directory under a configured filesystem root. This tool is registered only when agent import is explicitly enabled.',
    inputSchema: {
      type: 'object',
      properties: {
        directoryPath: {
          type: 'string',
          description: 'Absolute or provider-root-qualified existing directory path.',
        },
        fileName: {
          type: 'string',
          description: 'Destination file name only. Path separators and traversal are rejected.',
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
