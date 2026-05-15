import { useEffect, useRef } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type { FileSystemEventMap } from '../shared/protocol';
import { PLUGIN_ID } from '../shared/protocol';
import { joinPath, normalizeDirPath } from '../shared/path';
import {
  resolveFileSystemAdapter,
  resolveFileTransferCapabilities,
  safeError,
  type FileSystemAdapter,
  type FileSystemRoot,
  type UseFileSystemDevToolsOptions,
} from './fileSystemProvider';
import { useFileSystemAgentTools } from './useFileSystemAgentTools';

export type { UseFileSystemDevToolsOptions } from './fileSystemProvider';

export const useFileSystemDevTools = (
  options?: UseFileSystemDevToolsOptions,
) => {
  useFileSystemAgentTools(options);
  const fileTransfer = resolveFileTransferCapabilities(options);

  const client = useRozeniteDevToolsClient<FileSystemEventMap>({
    pluginId: PLUGIN_ID,
  });

  const subsRef = useRef<Array<{ remove: () => void }>>([]);

  useEffect(() => {
    if (!client) return;

    client.send('fs:ready', { timestamp: Date.now() });

    subsRef.current.push(
      client.onMessage('fs:get-roots', async ({ requestId }) => {
        try {
          const provider = await resolveFileSystemAdapter(options);
          if (!provider) {
            client.send('fs:get-roots:result', {
              requestId,
              provider: 'none',
              fileTransfer,
              roots: [],
              error:
                'No filesystem provider detected. Pass `adapter: createExpoFileSystemAdapter(FileSystem)` or `adapter: createRNFSAdapter(RNFS)` to `useFileSystemDevTools()`.',
            });
            return;
          }

          const roots = await provider.getRoots();
          client.send('fs:get-roots:result', {
            requestId,
            provider: provider.provider,
            fileTransfer,
            roots,
          });
        } catch (e) {
          client.send('fs:get-roots:result', {
            requestId,
            provider: 'none',
            fileTransfer,
            roots: [],
            error: safeError(e),
          });
        }
      }),
    );

    subsRef.current.push(
      client.onMessage('fs:list', async ({ requestId, path }) => {
        try {
          const provider = await resolveFileSystemAdapter(options);
          if (!provider) {
            client.send('fs:list:result', {
              requestId,
              provider: 'none',
              path,
              entries: [],
              error:
                'No filesystem provider detected. Pass `adapter: createExpoFileSystemAdapter(FileSystem)` or `adapter: createRNFSAdapter(RNFS)` to `useFileSystemDevTools()`.',
            });
            return;
          }

          const entries = await provider.listDir(path);
          client.send('fs:list:result', {
            requestId,
            provider: provider.provider,
            path,
            entries,
          });
        } catch (e) {
          const provider = await resolveFileSystemAdapter(options);
          client.send('fs:list:result', {
            requestId,
            provider: provider?.provider ?? 'none',
            path,
            entries: [],
            error: safeError(e),
          });
        }
      }),
    );

    subsRef.current.push(
      client.onMessage(
        'fs:read-image',
        async ({ requestId, path, maxBytes }) => {
          try {
            const provider = await resolveFileSystemAdapter(options);
            if (!provider) {
              client.send('fs:read-image:result', {
                requestId,
                provider: 'none',
                path,
                error:
                  'No filesystem provider detected. Pass `adapter: createExpoFileSystemAdapter(FileSystem)` or `adapter: createRNFSAdapter(RNFS)` to `useFileSystemDevTools()`.',
              });
              return;
            }

            const { mime, base64 } = await provider.readImageBase64(
              path,
              typeof maxBytes === 'number' ? maxBytes : 10_000_000,
            );

            client.send('fs:read-image:result', {
              requestId,
              provider: provider.provider,
              path,
              dataUri: `data:${mime};base64,${base64}`,
            });
          } catch (e) {
            const provider = await resolveFileSystemAdapter(options);
            client.send('fs:read-image:result', {
              requestId,
              provider: provider?.provider ?? 'none',
              path,
              error: safeError(e),
            });
          }
        },
      ),
    );

    subsRef.current.push(
      client.onMessage(
        'fs:read-file',
        async ({ requestId, path, maxBytes }) => {
          try {
            const provider = await resolveFileSystemAdapter(options);
            if (!provider) {
              client.send('fs:read-file:result', {
                requestId,
                provider: 'none',
                path,
                error:
                  'No filesystem provider detected. Pass `adapter: createExpoFileSystemAdapter(FileSystem)` or `adapter: createRNFSAdapter(RNFS)` to `useFileSystemDevTools()`.',
              });
              return;
            }

            const content = await provider.readTextFile(
              path,
              typeof maxBytes === 'number' ? maxBytes : 10_000_000,
            );

            client.send('fs:read-file:result', {
              requestId,
              provider: provider.provider,
              path,
              content,
            });
          } catch (e) {
            const provider = await resolveFileSystemAdapter(options);
            client.send('fs:read-file:result', {
              requestId,
              provider: provider?.provider ?? 'none',
              path,
              error: safeError(e),
            });
          }
        },
      ),
    );

    subsRef.current.push(
      client.onMessage('fs:export-file', async ({ requestId, path }) => {
        try {
          if (!fileTransfer.export) {
            client.send('fs:export-file:result', {
              requestId,
              provider: 'none',
              path,
              error:
                'File export is disabled. Enable `fileTransfer.export` in `useFileSystemDevTools()`.',
            });
            return;
          }

          const provider = await resolveFileSystemAdapter(options);
          if (!provider) {
            client.send('fs:export-file:result', {
              requestId,
              provider: 'none',
              path,
              error:
                'No filesystem provider detected. Pass `adapter: createExpoFileSystemAdapter(FileSystem)` or `adapter: createRNFSAdapter(RNFS)` to `useFileSystemDevTools()`.',
            });
            return;
          }

          if (!provider.readFileBase64) {
            client.send('fs:export-file:result', {
              requestId,
              provider: provider.provider,
              path,
              error: 'The active filesystem adapter does not support export.',
            });
            return;
          }

          const roots = await provider.getRoots();
          assertInsideRoots(path, roots);
          const entry = await provider.statPath(path);
          if (entry.isDirectory) {
            throw new Error(`Path "${entry.path}" is a directory, not a file.`);
          }

          const file = await provider.readFileBase64(entry.path);
          client.send('fs:export-file:result', {
            requestId,
            provider: provider.provider,
            path: entry.path,
            fileName: file.fileName,
            mime: file.mime,
            size: file.size,
            base64: file.base64,
          });
        } catch (e) {
          const provider = await resolveFileSystemAdapter(options);
          client.send('fs:export-file:result', {
            requestId,
            provider: provider?.provider ?? 'none',
            path,
            error: safeError(e),
          });
        }
      }),
    );

    subsRef.current.push(
      client.onMessage(
        'fs:import-file',
        async ({ requestId, directoryPath, fileName, base64, overwrite }) => {
          try {
            if (!fileTransfer.import) {
              client.send('fs:import-file:result', {
                requestId,
                provider: 'none',
                directoryPath,
                error:
                  'File import is disabled. Enable `fileTransfer.import` in `useFileSystemDevTools()`.',
              });
              return;
            }

            const provider = await resolveFileSystemAdapter(options);
            if (!provider) {
              client.send('fs:import-file:result', {
                requestId,
                provider: 'none',
                directoryPath,
                error:
                  'No filesystem provider detected. Pass `adapter: createExpoFileSystemAdapter(FileSystem)` or `adapter: createRNFSAdapter(RNFS)` to `useFileSystemDevTools()`.',
              });
              return;
            }

            if (!provider.writeFileBase64) {
              client.send('fs:import-file:result', {
                requestId,
                provider: provider.provider,
                directoryPath,
                error: 'The active filesystem adapter does not support import.',
              });
              return;
            }

            assertSafeFileName(fileName);
            const roots = await provider.getRoots();
            const normalizedDirectoryPath = normalizeDirPath(directoryPath);
            assertInsideRoots(normalizedDirectoryPath, roots);

            const directory = await provider.statPath(normalizedDirectoryPath);
            if (!directory.isDirectory) {
              throw new Error(
                `Path "${directory.path}" is not a directory.`,
              );
            }

            const destinationPath = joinPath(directory.path, fileName);
            assertInsideRoots(destinationPath, roots);

            if (!overwrite && (await pathExists(provider, destinationPath))) {
              client.send('fs:import-file:result', {
                requestId,
                provider: provider.provider,
                directoryPath: directory.path,
                path: destinationPath,
                overwriteRequired: true,
              });
              return;
            }

            const entry = await provider.writeFileBase64(
              destinationPath,
              base64,
            );
            client.send('fs:import-file:result', {
              requestId,
              provider: provider.provider,
              directoryPath: directory.path,
              path: entry.path,
              entry,
            });
          } catch (e) {
            const provider = await resolveFileSystemAdapter(options);
            client.send('fs:import-file:result', {
              requestId,
              provider: provider?.provider ?? 'none',
              directoryPath,
              error: safeError(e),
            });
          }
        },
      ),
    );

    return () => {
      subsRef.current.forEach((s) => s.remove());
      subsRef.current = [];
    };
  }, [client, fileTransfer.export, fileTransfer.import, options]);
};

async function pathExists(
  provider: FileSystemAdapter,
  path: string,
): Promise<boolean> {
  if (provider.pathExists) {
    return provider.pathExists(path);
  }

  try {
    await provider.statPath(path);
    return true;
  } catch {
    return false;
  }
}

function assertInsideRoots(path: string, roots: FileSystemRoot[]): void {
  if (hasTraversalSegment(path)) {
    throw new Error('Path must not contain traversal segments.');
  }

  const isInside = roots.some((root) => {
    const rootPath = normalizeDirPath(root.path);
    return path === rootPath || path.startsWith(rootPath);
  });

  if (!isInside) {
    throw new Error('Path is outside the configured filesystem roots.');
  }
}

function hasTraversalSegment(path: string): boolean {
  return path
    .replace(/^file:\/\//, '')
    .split('/')
    .some((segment) => segment === '..');
}

function assertSafeFileName(fileName: string): void {
  if (
    !fileName ||
    fileName === '.' ||
    fileName === '..' ||
    fileName.includes('/') ||
    fileName.includes('\\')
  ) {
    throw new Error('Imported file name must be a single file name.');
  }
}
