import { useCallback } from 'react';
import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import type {
  FileSystemAdapter,
  UseFileSystemDevToolsOptions,
} from './fileSystemProvider';
import {
  resolveAgentFileTransferCapabilities,
  resolveFileSystemAdapter,
} from './fileSystemProvider';
import { exportFileTransfer, importFileTransfer } from './fileTransfer';
import {
  FILE_SYSTEM_AGENT_PLUGIN_ID,
  fileSystemToolDefinitions,
  type FileSystemExportFileArgs,
  type FileSystemImportFileArgs,
  type FileSystemListEntriesArgs,
  type FileSystemPathArgs,
  type FileSystemReadFileArgs,
} from '../shared/agent-tools';
import type { FileSystemAgentTransferCapabilities } from '../shared/protocol';

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

const createAttribution = (operation: 'export-file' | 'import-file') => ({
  triggeredBy: 'agent' as const,
  pluginId: FILE_SYSTEM_AGENT_PLUGIN_ID,
  operation,
});

const assertAgentTransferEnabled = (
  capabilities: FileSystemAgentTransferCapabilities,
  operation: keyof FileSystemAgentTransferCapabilities,
): void => {
  if (!capabilities[operation]) {
    throw new Error(
      `Agent file ${operation} is disabled. Enable \`fileTransfer.agent.${operation}\` in \`useFileSystemDevTools()\`.`,
    );
  }
};

export const getFileSystemAgentTools = (
  capabilities: FileSystemAgentTransferCapabilities = {
    import: false,
    export: false,
  },
) => [
  fileSystemToolDefinitions.listRoots,
  fileSystemToolDefinitions.listEntries,
  fileSystemToolDefinitions.readEntry,
  fileSystemToolDefinitions.readTextFile,
  fileSystemToolDefinitions.readImageFile,
  ...(capabilities.export ? [fileSystemToolDefinitions.exportFile] : []),
  ...(capabilities.import ? [fileSystemToolDefinitions.importFile] : []),
];

export const fileSystemAgentTools = getFileSystemAgentTools();

export const createFileSystemAgentHandlers = (
  resolveProvider: () => Promise<FileSystemAdapter | null>,
  agentFileTransfer: FileSystemAgentTransferCapabilities = {
    import: false,
    export: false,
  },
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

  exportFile: async ({ path }: FileSystemExportFileArgs) => {
    assertAgentTransferEnabled(agentFileTransfer, 'export');
    const provider = await getProviderOrThrow(resolveProvider);
    const result = await exportFileTransfer(provider, path);

    return {
      ...result,
      attribution: createAttribution('export-file'),
    };
  },

  importFile: async ({
    directoryPath,
    fileName,
    base64,
    overwrite,
  }: FileSystemImportFileArgs) => {
    assertAgentTransferEnabled(agentFileTransfer, 'import');
    const provider = await getProviderOrThrow(resolveProvider);
    const result = await importFileTransfer(provider, {
      directoryPath,
      fileName,
      base64,
      overwrite,
    });

    return {
      ...result,
      attribution: createAttribution('import-file'),
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
  const agentFileTransfer = resolveAgentFileTransferCapabilities(options);

  const handlers = createFileSystemAgentHandlers(
    resolveProvider,
    agentFileTransfer,
  );

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

  useRozenitePluginAgentTool({
    pluginId: FILE_SYSTEM_AGENT_PLUGIN_ID,
    tool: fileSystemToolDefinitions.exportFile,
    handler: handlers.exportFile,
    enabled: agentFileTransfer.export,
  });

  useRozenitePluginAgentTool({
    pluginId: FILE_SYSTEM_AGENT_PLUGIN_ID,
    tool: fileSystemToolDefinitions.importFile,
    handler: handlers.importFile,
    enabled: agentFileTransfer.import,
  });
};
