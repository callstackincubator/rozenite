import { useCallback, useRef, useState } from 'react';
import type { FsEntry } from './shared/protocol';
import type { useFileSystemRequests } from './use-file-system-requests';

type FileSystemRequests = ReturnType<typeof useFileSystemRequests>;

export type FileTreeChildrenState = FsEntry[] | 'loading' | 'error';

/**
 * Lazy-loaded state for the sidebar's directory tree (Feature 1, Version A):
 * an arbitrary-depth tree where each directory's children are fetched via
 * `fs:list` the first time it's expanded, then cached by path.
 */
export function useFileSystemTree(requests: FileSystemRequests) {
  const [childrenByPath, setChildrenByPath] = useState<Map<string, FileTreeChildrenState>>(
    new Map(),
  );
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const cacheRef = useRef<Map<string, FileTreeChildrenState>>(new Map());

  const publish = useCallback(() => {
    setChildrenByPath(new Map(cacheRef.current));
  }, []);

  const load = useCallback(
    async (path: string) => {
      if (cacheRef.current.has(path)) return;
      cacheRef.current.set(path, 'loading');
      publish();

      try {
        const res = await requests.requestList(path);
        if (!res || res.error) {
          cacheRef.current.set(path, 'error');
        } else {
          cacheRef.current.set(path, res.entries);
        }
      } catch {
        cacheRef.current.set(path, 'error');
      } finally {
        publish();
      }
    },
    [publish, requests.requestList],
  );

  const setExpanded = useCallback(
    (path: string, expanded: boolean) => {
      setExpandedPaths((current) => {
        const next = new Set(current);
        if (expanded) {
          next.add(path);
        } else {
          next.delete(path);
        }
        return next;
      });
      if (expanded) {
        void load(path);
      }
    },
    [load],
  );

  const invalidate = useCallback(
    (path: string) => {
      cacheRef.current.delete(path);
      publish();
      if (expandedPaths.has(path)) {
        void load(path);
      }
    },
    [expandedPaths, load, publish],
  );

  const reset = useCallback(() => {
    cacheRef.current = new Map();
    setChildrenByPath(new Map());
    setExpandedPaths(new Set());
  }, []);

  return {
    childrenByPath,
    expandedPaths,
    setExpanded,
    invalidate,
    reset,
  };
}

export type FileSystemTreeState = ReturnType<typeof useFileSystemTree>;
