import { useCallback } from 'react';
import { useRozenitePluginAgentTool, type AgentTool } from '@rozenite/agent-bridge';
import type { ProviderImpl, UseFileSystemDevToolsOptions } from './fileSystemProvider';
import { detectProvider } from './fileSystemProvider';

type PathInput = {
  path: string;
};

type ListEntriesInput = PathInput & {
  offset?: number;
  limit?: number;
};

type ReadFileInput = PathInput & {
  maxBytes?: number;
};

export const FILE_SYSTEM_AGENT_PLUGIN_ID = '@rozenite/file-system-plugin';

export const listRootsTool: AgentTool = {
  name: 'list-roots',
  description:
    'List the filesystem roots currently available on the device and report which provider is active.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const listEntriesTool: AgentTool = {
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
};

export const readEntryTool: AgentTool = {
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
};

export const readTextFileTool: AgentTool = {
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
};

export const readImageFileTool: AgentTool = {
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
};

export const fileSystemAgentTools = [
  listRootsTool,
  listEntriesTool,
  readEntryTool,
  readTextFileTool,
  readImageFileTool,
] as const;

const getProviderOrThrow = async (
  resolveProvider: () => Promise<ProviderImpl | null>,
): Promise<ProviderImpl> => {
  const provider = await resolveProvider();
  if (!provider) {
    throw new Error(
      'No filesystem provider detected. Pass `{ expoFileSystem: FileSystem }` (Expo) or `{ rnfs: RNFS }` (bare RN) to `useFileSystemDevTools()`.',
    );
  }
  return provider;
};

export const createFileSystemAgentHandlers = (
  resolveProvider: () => Promise<ProviderImpl | null>,
) => ({
  listRoots: async () => {
    const provider = await resolveProvider();
    if (!provider) {
      return {
        provider: 'none' as const,
        roots: [],
      };
    }

    return {
      provider: provider.provider,
      roots: await provider.getRoots(),
    };
  },

  listEntries: async ({ path, offset = 0, limit = 100 }: ListEntriesInput) => {
    const provider = await getProviderOrThrow(resolveProvider);
    const allEntries = await provider.listDir(path);
    const safeOffset = Math.max(0, Math.floor(offset));
    const safeLimit = Math.max(1, Math.floor(limit));

    return {
      provider: provider.provider,
      path,
      total: allEntries.length,
      offset: safeOffset,
      limit: safeLimit,
      entries: allEntries.slice(safeOffset, safeOffset + safeLimit),
    };
  },

  readEntry: async ({ path }: PathInput) => {
    const provider = await getProviderOrThrow(resolveProvider);
    const entry = await provider.statPath(path);

    return {
      provider: provider.provider,
      path: entry.path,
      entry,
    };
  },

  readTextFile: async ({ path, maxBytes = 10_000_000 }: ReadFileInput) => {
    const provider = await getProviderOrThrow(resolveProvider);
    const entry = await provider.statPath(path);

    if (entry.isDirectory) {
      throw new Error(`Path "${entry.path}" is a directory, not a file.`);
    }

    return {
      provider: provider.provider,
      path: entry.path,
      mimeTypeHint: entry.mimeTypeHint ?? null,
      size: entry.size ?? null,
      content: await provider.readTextFile(entry.path, maxBytes),
    };
  },

  readImageFile: async ({ path, maxBytes = 10_000_000 }: ReadFileInput) => {
    const provider = await getProviderOrThrow(resolveProvider);
    const entry = await provider.statPath(path);

    if (entry.isDirectory) {
      throw new Error(`Path "${entry.path}" is a directory, not a file.`);
    }

    const preview = await provider.readImageBase64(entry.path, maxBytes);

    return {
      provider: provider.provider,
      path: entry.path,
      mimeTypeHint: entry.mimeTypeHint ?? null,
      size: entry.size ?? null,
      dataUri: `data:${preview.mime};base64,${preview.base64}`,
    };
  },
});

export const useFileSystemAgentTools = (
  options?: UseFileSystemDevToolsOptions,
) => {
  const resolveProvider = useCallback(
    () => detectProvider(options),
    [options?.expoFileSystem, options?.rnfs],
  );

  const handlers = createFileSystemAgentHandlers(resolveProvider);

  useRozenitePluginAgentTool({
    pluginId: FILE_SYSTEM_AGENT_PLUGIN_ID,
    tool: listRootsTool,
    handler: handlers.listRoots,
  });

  useRozenitePluginAgentTool<ListEntriesInput>({
    pluginId: FILE_SYSTEM_AGENT_PLUGIN_ID,
    tool: listEntriesTool,
    handler: handlers.listEntries,
  });

  useRozenitePluginAgentTool<PathInput>({
    pluginId: FILE_SYSTEM_AGENT_PLUGIN_ID,
    tool: readEntryTool,
    handler: handlers.readEntry,
  });

  useRozenitePluginAgentTool<ReadFileInput>({
    pluginId: FILE_SYSTEM_AGENT_PLUGIN_ID,
    tool: readTextFileTool,
    handler: handlers.readTextFile,
  });

  useRozenitePluginAgentTool<ReadFileInput>({
    pluginId: FILE_SYSTEM_AGENT_PLUGIN_ID,
    tool: readImageFileTool,
    handler: handlers.readImageFile,
  });
};
