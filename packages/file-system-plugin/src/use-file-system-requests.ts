import { useCallback, useEffect, useRef } from 'react';
import type { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type { FileSystemEventMap } from './shared/protocol';
import { newRequestId, withTimeout } from './utils';

type PendingResolvers = {
  roots: Map<
    string,
    (payload: FileSystemEventMap['fs:get-roots:result']) => void
  >;
  list: Map<string, (payload: FileSystemEventMap['fs:list:result']) => void>;
  image: Map<
    string,
    (payload: FileSystemEventMap['fs:read-image:result']) => void
  >;
  file: Map<
    string,
    (payload: FileSystemEventMap['fs:read-file:result']) => void
  >;
};

export function useFileSystemRequests(
  client: RozeniteDevToolsClient<FileSystemEventMap> | null,
) {
  const pendingRef = useRef<PendingResolvers>({
    roots: new Map(),
    list: new Map(),
    image: new Map(),
    file: new Map(),
  });

  useEffect(() => {
    if (!client) return;

    const subRoots = client.onMessage('fs:get-roots:result', (payload) => {
      const resolve = pendingRef.current.roots.get(payload.requestId);
      if (resolve) {
        pendingRef.current.roots.delete(payload.requestId);
        resolve(payload);
      }
    });

    const subList = client.onMessage('fs:list:result', (payload) => {
      const resolve = pendingRef.current.list.get(payload.requestId);
      if (resolve) {
        pendingRef.current.list.delete(payload.requestId);
        resolve(payload);
      }
    });

    const subImage = client.onMessage('fs:read-image:result', (payload) => {
      const resolve = pendingRef.current.image.get(payload.requestId);
      if (resolve) {
        pendingRef.current.image.delete(payload.requestId);
        resolve(payload);
      }
    });

    const subFile = client.onMessage('fs:read-file:result', (payload) => {
      const resolve = pendingRef.current.file.get(payload.requestId);
      if (resolve) {
        pendingRef.current.file.delete(payload.requestId);
        resolve(payload);
      }
    });

    return () => {
      subRoots.remove();
      subList.remove();
      subImage.remove();
      subFile.remove();
    };
  }, [client]);

  const requestRoots = useCallback(async () => {
    if (!client) return null;
    const requestId = newRequestId();
    const p = new Promise<FileSystemEventMap['fs:get-roots:result']>(
      (resolve) => {
        pendingRef.current.roots.set(requestId, resolve);
      },
    );
    client.send('fs:get-roots', { requestId });
    return await withTimeout(p, 8000, 'Timeout fetching roots');
  }, [client]);

  const requestList = useCallback(
    async (path: string) => {
      if (!client) return null;
      const requestId = newRequestId();
      const p = new Promise<FileSystemEventMap['fs:list:result']>((resolve) => {
        pendingRef.current.list.set(requestId, resolve);
      });
      client.send('fs:list', { requestId, path });
      return await withTimeout(p, 15000, 'Timeout listing directory');
    },
    [client],
  );

  const requestImagePreview = useCallback(
    async (path: string, maxBytes = 10_000_000) => {
      if (!client) return null;
      const requestId = newRequestId();
      const p = new Promise<FileSystemEventMap['fs:read-image:result']>(
        (resolve) => {
          pendingRef.current.image.set(requestId, resolve);
        },
      );
      client.send('fs:read-image', { requestId, path, maxBytes });
      return await withTimeout(p, 15000, 'Timeout reading image');
    },
    [client],
  );

  const requestTextPreview = useCallback(
    async (path: string, maxBytes = 10_000_000) => {
      if (!client) return null;
      const requestId = newRequestId();
      const p = new Promise<FileSystemEventMap['fs:read-file:result']>(
        (resolve) => {
          pendingRef.current.file.set(requestId, resolve);
        },
      );
      client.send('fs:read-file', { requestId, path, maxBytes });
      return await withTimeout(p, 15000, 'Timeout reading file');
    },
    [client],
  );

  return { requestRoots, requestList, requestImagePreview, requestTextPreview };
}
