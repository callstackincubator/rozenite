import { useCallback } from 'react';
import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import { paginateArray } from '@rozenite/agent-shared';
import type { FileSystemAdapter, UseFileSystemDevToolsOptions } from './fileSystemProvider';
import {
  resolveAgentFileTransferCapabilities,
  resolveFileSystemAdapter,
} from './fileSystemProvider';
import { exportFileTransfer, importFileTransfer } from './fileTransfer';
import { normalizeByteArg, sliceUtf8 } from './byte-range';
import {
  FILE_SYSTEM_AGENT_PLUGIN_ID,
  FILE_SYSTEM_DEFAULT_EXPORT_BYTES,
  FILE_SYSTEM_DEFAULT_INLINE_IMAGE_BYTES,
  FILE_SYSTEM_DEFAULT_TEXT_BYTES,
  FILE_SYSTEM_MAX_TEXT_BYTES,
  fileSystemToolDefinitions,
  type FileSystemExportFileArgs,
  type FileSystemImportFileArgs,
  type FileSystemListEntriesArgs,
  type FileSystemListEntriesResult,
  type FileSystemPathArgs,
  type FileSystemReadImageFileArgs,
  type FileSystemReadImageFileResult,
  type FileSystemReadTextFileArgs,
  type FileSystemReadTextFileResult,
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
    limit,
    cursor,
    offset,
  }: FileSystemListEntriesArgs): Promise<FileSystemListEntriesResult> => {
    if (cursor !== undefined && offset !== undefined) {
      throw new Error('Provide either cursor or offset, not both.');
    }

    const provider = await getProviderOrThrow(resolveProvider);
    const allEntries = await provider.listDir(path);
    // `offset` is deprecated: it only picks where the first page starts.
    const start =
      cursor === undefined && typeof offset === 'number' && Number.isFinite(offset)
        ? Math.max(0, Math.floor(offset))
        : 0;
    const { items, page } = paginateArray(allEntries.slice(start), {
      keyOf: (entry) => entry.path,
      limit,
      cursor,
      scope: path,
    });

    return {
      provider: provider.provider,
      path,
      total: allEntries.length,
      offset:
        items.length > 0
          ? allEntries.indexOf(items[0])
          : page.reset
            ? 0
            : cursor !== undefined
              ? allEntries.length
              : Math.min(start, allEntries.length),
      limit: page.limit,
      entries: items,
      page,
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
    offset: rawOffset,
    maxBytes: rawMaxBytes,
  }: FileSystemReadTextFileArgs): Promise<FileSystemReadTextFileResult> => {
    const offset = normalizeByteArg(rawOffset, 'offset', 0, { min: 0 });
    const maxBytes = normalizeByteArg(rawMaxBytes, 'maxBytes', FILE_SYSTEM_DEFAULT_TEXT_BYTES, {
      max: FILE_SYSTEM_MAX_TEXT_BYTES,
    });
    const provider = await getProviderOrThrow(resolveProvider);
    const entry = await provider.statPath(path);

    if (entry.isDirectory) {
      throw new Error(`Path "${entry.path}" is a directory, not a file.`);
    }

    // Providers refuse files above their limit rather than cutting them, so
    // read up to the ceiling and take the requested range here.
    const content = await provider.readTextFile(entry.path, FILE_SYSTEM_MAX_TEXT_BYTES);
    const range = sliceUtf8(content, offset, maxBytes);

    return {
      provider: provider.provider,
      path: entry.path,
      mimeTypeHint: entry.mimeTypeHint ?? null,
      size: entry.size ?? null,
      content: range.text,
      offset: range.offset,
      totalBytes: range.totalBytes,
      truncated: range.truncated,
    };
  },

  readImageFile: async ({
    path,
    inline = false,
    maxBytes: rawMaxBytes,
  }: FileSystemReadImageFileArgs): Promise<FileSystemReadImageFileResult> => {
    const maxBytes = normalizeByteArg(
      rawMaxBytes,
      'maxBytes',
      FILE_SYSTEM_DEFAULT_INLINE_IMAGE_BYTES,
      { max: FILE_SYSTEM_MAX_TEXT_BYTES },
    );
    const provider = await getProviderOrThrow(resolveProvider);
    const entry = await provider.statPath(path);

    if (entry.isDirectory) {
      throw new Error(`Path "${entry.path}" is a directory, not a file.`);
    }

    const metadata = {
      provider: provider.provider,
      path: entry.path,
      mimeTypeHint: entry.mimeTypeHint ?? null,
      size: entry.size ?? null,
    };
    if (!inline) {
      return metadata;
    }

    const preview = await provider.readImageBase64(entry.path, maxBytes);
    return {
      ...metadata,
      dataUri: `data:${preview.mime};base64,${preview.base64}`,
    };
  },

  exportFile: async ({ path, maxBytes: rawMaxBytes }: FileSystemExportFileArgs) => {
    assertAgentTransferEnabled(agentFileTransfer, 'export');
    const maxBytes = normalizeByteArg(rawMaxBytes, 'maxBytes', FILE_SYSTEM_DEFAULT_EXPORT_BYTES);
    const provider = await getProviderOrThrow(resolveProvider);
    const result = await exportFileTransfer(provider, path, { maxBytes });

    return {
      ...result,
      attribution: createAttribution('export-file'),
    };
  },

  importFile: async ({ directoryPath, fileName, base64, overwrite }: FileSystemImportFileArgs) => {
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

export const useFileSystemAgentTools = (options?: UseFileSystemDevToolsOptions) => {
  const resolveProvider = useCallback(
    () => resolveFileSystemAdapter(options),
    [options?.adapter, options?.expoFileSystem, options?.rnfs],
  );
  const agentFileTransfer = resolveAgentFileTransferCapabilities(options);

  const handlers = createFileSystemAgentHandlers(resolveProvider, agentFileTransfer);

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
