import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type {
  FileSystemEventMap,
  FileSystemProvider,
  FsEntry,
  FsRoots,
} from './shared/protocol';
import { parentPath } from './shared/path';
import type { useFileSystemRequests } from './use-file-system-requests';

type FileSystemRequests = ReturnType<typeof useFileSystemRequests>;

export function useFileSystemNavigation(
  client: RozeniteDevToolsClient<FileSystemEventMap> | null,
  requests: FileSystemRequests,
) {
  const [provider, setProvider] = useState<FileSystemProvider>('none');
  const [roots, setRoots] = useState<FsRoots['roots']>([]);
  const [pathInput, setPathInput] = useState('');
  const [currentPath, setCurrentPath] = useState('');

  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRootsAndMaybeInit = useCallback(async () => {
    setError(null);
    const res = await requests.requestRoots();
    if (!res) return;
    setProvider(res.provider);
    if (res.error) {
      setRoots([]);
      setError(res.error);
      return;
    }
    setRoots(res.roots);

    // Initialize path to first root only once
    if (!currentPath && res.roots.length > 0) {
      const first = res.roots[0]!.path;
      setPathInput(first);
      setCurrentPath(first);
    }
  }, [currentPath, requests.requestRoots]);

  useEffect(() => {
    if (!client) return;
    loadRootsAndMaybeInit();
  }, [client, loadRootsAndMaybeInit]);

  const loadDir = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);

      try {
        const res = await requests.requestList(path);
        if (!res) return;
        setProvider(res.provider);
        setCurrentPath(res.path);
        setPathInput(res.path);
        if (res.error) {
          setEntries([]);
          setError(res.error);
          return;
        }
        setEntries(res.entries);
      } catch (e) {
        setEntries([]);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [requests.requestList],
  );

  useEffect(() => {
    if (!client) return;
    if (!currentPath) return;
    loadDir(currentPath);
  }, [client, currentPath]);

  // Handle RN app ready/reconnect - re-fetch data when RN side (re)initializes
  useEffect(() => {
    if (!client) return;

    const subReady = client.onMessage('fs:ready', async () => {
      // Reset UI state on reconnect
      setProvider('none');
      setRoots([]);
      setEntries([]);
      setError(null);

      // Re-fetch roots
      await loadRootsAndMaybeInit();

      // If user was in a directory, reload it
      if (currentPath) {
        loadDir(currentPath);
      }
    });

    return () => {
      subReady.remove();
    };
  }, [client, currentPath, loadDir, loadRootsAndMaybeInit]);

  const onGo = useCallback(() => {
    const next = pathInput.trim();
    if (!next) return;
    setCurrentPath(next);
  }, [pathInput]);

  // Check if we can go back (not at or above a root path)
  const canGoBack = useMemo(() => {
    if (!currentPath) return false;
    // If current path is one of the roots, we can't go up
    const isAtRoot = roots.some((r) => r.path === currentPath);
    if (isAtRoot) return false;
    // Check if parent path exists and we wouldn't go above a root
    const parent = parentPath(currentPath);
    if (!parent) return false;
    // Ensure we're still within one of the root paths
    return roots.some((r) => parent.startsWith(r.path) || parent === r.path);
  }, [currentPath, roots]);

  const onBack = useCallback(() => {
    if (!canGoBack) return;
    const p = parentPath(currentPath);
    if (!p) return;
    setCurrentPath(p);
  }, [currentPath, canGoBack]);

  const onReload = useCallback(() => {
    if (!currentPath) return;
    loadDir(currentPath);
  }, [currentPath, loadDir]);

  return {
    provider,
    roots,
    pathInput,
    setPathInput,
    currentPath,
    setCurrentPath,
    entries,
    loading,
    error,
    canGoBack,
    onGo,
    onBack,
    onReload,
  };
}
