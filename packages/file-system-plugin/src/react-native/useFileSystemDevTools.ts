import { useEffect, useRef } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type { FileSystemEventMap } from '../shared/protocol';
import { PLUGIN_ID } from '../shared/protocol';
import {
  resolveFileSystemAdapter,
  safeError,
  type UseFileSystemDevToolsOptions,
} from './fileSystemProvider';
import { useFileSystemAgentTools } from './useFileSystemAgentTools';

export type { UseFileSystemDevToolsOptions } from './fileSystemProvider';

export const useFileSystemDevTools = (
  options?: UseFileSystemDevToolsOptions,
) => {
  useFileSystemAgentTools(options);

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
              roots: [],
              error:
                'No filesystem provider detected. Pass `{ expoFileSystem: FileSystem }` (Expo) or `{ rnfs: RNFS }` (bare RN) to `useFileSystemDevTools()`.',
            });
            return;
          }

          const roots = await provider.getRoots();
          client.send('fs:get-roots:result', {
            requestId,
            provider: provider.provider,
            roots,
          });
        } catch (e) {
          client.send('fs:get-roots:result', {
            requestId,
            provider: 'none',
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
                'No filesystem provider detected. Pass `{ expoFileSystem: FileSystem }` (Expo) or `{ rnfs: RNFS }` (bare RN) to `useFileSystemDevTools()`.',
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
                  'No filesystem provider detected. Pass `{ expoFileSystem: FileSystem }` (Expo) or `{ rnfs: RNFS }` (bare RN) to `useFileSystemDevTools()`.',
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
                  'No filesystem provider detected. Pass `{ expoFileSystem: FileSystem }` (Expo) or `{ rnfs: RNFS }` (bare RN) to `useFileSystemDevTools()`.',
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

    return () => {
      subsRef.current.forEach((s) => s.remove());
      subsRef.current = [];
    };
  }, [client, options]);
};
