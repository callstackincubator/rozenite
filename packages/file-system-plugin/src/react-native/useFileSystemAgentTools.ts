import { useCallback } from 'react';
import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import type {
  FileSystemAdapter,
  UseFileSystemDevToolsOptions,
} from './fileSystemProvider';
import { resolveFileSystemAdapter } from './fileSystemProvider';
import {
  FILE_SYSTEM_AGENT_PLUGIN_ID,
  fileSystemToolDefinitions,
  type FileSystemListEntriesArgs,
  type FileSystemPathArgs,
  type FileSystemReadFileArgs,
} from '../shared/agent-tools';

export const fileSystemAgentTools = Object.values(fileSystemToolDefinitions);

const getProviderOrThrow = async (
  resolveProvider: () => Promise<FileSystemAdapter | null>,
): Promise<FileSystemAdapter> => {
  const provider = await resolveProvider();
  if (!provider) {
    throw new Error(
      'No filesystem provider detected. Pass `adapter: createExpoFileSystemAdapter(FileSystem)` or `adapter: createRNFSAdapter(RNFS)` to `useFileSystemDevTools()`.',
    );
  }
  return provider;
};

export const createFileSystemAgentHandlers = (
  resolveProvider: () => Promise<FileSystemAdapter | null>,
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

  listEntries: async ({
    path,
    offset = 0,
    limit = 100,
  }: FileSystemListEntriesArgs) => {
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

  readEntry: async ({ path }: FileSystemPathArgs) => {
    const provider = await getProviderOrThrow(resolveProvider);
    const entry = await provider.statPath(path);

    return {
      provider: provider.provider,
      path: entry.path,
      entry,
    };
  },

  readTextFile: async ({
    path,
    maxBytes = 10_000_000,
  }: FileSystemReadFileArgs) => {
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

  readImageFile: async ({
    path,
    maxBytes = 10_000_000,
  }: FileSystemReadFileArgs) => {
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
    () => resolveFileSystemAdapter(options),
    [options?.adapter, options?.expoFileSystem, options?.rnfs],
  );

  const handlers = createFileSystemAgentHandlers(resolveProvider);

  useRozenitePluginAgentTool({
    pluginId: FILE_SYSTEM_AGENT_PLUGIN_ID,
    tool: fileSystemToolDefinitions.listRoots,
    handler: handlers.listRoots,
  });

  useRozenitePluginAgentTool({
    pluginId: FILE_SYSTEM_AGENT_PLUGIN_ID,
    tool: fileSystemToolDefinitions.listEntries,
    handler: handlers.listEntries,
  });

  useRozenitePluginAgentTool({
    pluginId: FILE_SYSTEM_AGENT_PLUGIN_ID,
    tool: fileSystemToolDefinitions.readEntry,
    handler: handlers.readEntry,
  });

  useRozenitePluginAgentTool({
    pluginId: FILE_SYSTEM_AGENT_PLUGIN_ID,
    tool: fileSystemToolDefinitions.readTextFile,
    handler: handlers.readTextFile,
  });

  useRozenitePluginAgentTool({
    pluginId: FILE_SYSTEM_AGENT_PLUGIN_ID,
    tool: fileSystemToolDefinitions.readImageFile,
    handler: handlers.readImageFile,
  });
};
