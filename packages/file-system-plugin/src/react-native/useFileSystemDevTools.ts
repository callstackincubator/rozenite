import { useEffect, useRef } from 'react';
import { Linking, Platform, Share } from 'react-native';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type { FileSystemEventMap } from '../shared/protocol';
import { PLUGIN_ID } from '../shared/protocol';
import {
  resolveFileSystemAdapter,
  resolveFileTransferCapabilities,
  safeError,
  type UseFileSystemDevToolsOptions,
} from './fileSystemProvider';
import { exportFileTransfer, importFileTransfer } from './fileTransfer';
import { useFileSystemAgentTools } from './useFileSystemAgentTools';

export type { UseFileSystemDevToolsOptions } from './fileSystemProvider';

/**
 * Returns the parent directory path for a given file path.
 * If the path is already a directory (ends with '/'), returns it as-is.
 */
function getParentDirectoryPath(filePath: string): string {
  const cleanPath = filePath.endsWith('/')
    ? filePath.slice(0, -1)
    : filePath;
  const lastSlash = cleanPath.lastIndexOf('/');
  if (lastSlash <= 0) return '/';
  return cleanPath.slice(0, lastSlash + 1);
}

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

          const file = await exportFileTransfer(provider, path);
          client.send('fs:export-file:result', {
            requestId,
            provider: file.provider,
            path: file.path,
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

            const result = await importFileTransfer(provider, {
              directoryPath,
              fileName,
              base64,
              overwrite,
            });

            if (result.overwriteRequired) {
              client.send('fs:import-file:result', {
                requestId,
                provider: result.provider,
                directoryPath: result.directoryPath,
                path: result.path,
                overwriteRequired: true,
              });
              return;
            }

            client.send('fs:import-file:result', {
              requestId,
              provider: result.provider,
              directoryPath: result.directoryPath,
              path: result.path,
              entry: result.entry,
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

    subsRef.current.push(
      client.onMessage(
        'fs:reveal-in-file-manager',
        async ({ requestId, path }) => {
          try {
            // For directories, open the directory itself.
            // For files, open the parent directory.
            const isDirectory = path.endsWith('/');
            const targetPath = isDirectory
              ? path
              : getParentDirectoryPath(path);

            // Build a file:// URL
            const fileUrl = targetPath.startsWith('file://')
              ? targetPath
              : `file://${targetPath}`;

            if (Platform.OS === 'ios' || Platform.OS === 'macos') {
              // On iOS, try Linking first, then fall back to Share
              try {
                const canOpen = await Linking.canOpenURL(fileUrl);
                if (canOpen) {
                  await Linking.openURL(fileUrl);
                  client.send('fs:reveal-in-file-manager:result', {
                    requestId,
                    path,
                  });
                  return;
                }
              } catch {
                // Linking failed, try Share as fallback
              }

              // Fallback: use the Share sheet so the user can open in Files app
              try {
                await Share.share({
                  url: fileUrl,
                  title: `Reveal: ${path}`,
                });
                client.send('fs:reveal-in-file-manager:result', {
                  requestId,
                  path,
                });
              } catch (shareError) {
                client.send('fs:reveal-in-file-manager:result', {
                  requestId,
                  path,
                  error: `Could not reveal file: ${safeError(shareError)}`,
                });
              }
            } else if (Platform.OS === 'android') {
              // On Android, use an ACTION_VIEW intent via Linking
              try {
                const contentUrl = `content://${targetPath}`;
                const canOpen = await Linking.canOpenURL(contentUrl);
                if (canOpen) {
                  await Linking.openURL(contentUrl);
                } else {
                  await Linking.openURL(fileUrl);
                }
                client.send('fs:reveal-in-file-manager:result', {
                  requestId,
                  path,
                });
              } catch (androidError) {
                client.send('fs:reveal-in-file-manager:result', {
                  requestId,
                  path,
                  error: `Could not reveal file on Android: ${safeError(androidError)}`,
                });
              }
            } else {
              // Unsupported platform
              client.send('fs:reveal-in-file-manager:result', {
                requestId,
                path,
                error: `Reveal in file manager is not supported on platform "${Platform.OS}". Path: ${path}`,
              });
            }
          } catch (e) {
            client.send('fs:reveal-in-file-manager:result', {
              requestId,
              path,
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
