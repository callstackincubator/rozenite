import { useEffect, useRef } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type {
  FileSystemEventMap,
  FileSystemProvider,
  FsEntry,
} from './src/shared/protocol';
import { PLUGIN_ID } from './src/shared/protocol';
import {
  joinPath,
  mimeTypeFromName,
  normalizeDirPath,
} from './src/shared/path';

type ProviderImpl = {
  provider: Exclude<FileSystemProvider, 'none'>;
  getRoots: () => Promise<
    Array<{
      id: string;
      label: string;
      path: string;
    }>
  >;
  listDir: (path: string) => Promise<FsEntry[]>;
  readImageBase64: (
    path: string,
    maxBytes: number,
  ) => Promise<{ mime: string; base64: string }>;
  readTextFile: (path: string, maxBytes: number) => Promise<string>;
};

export type UseFileSystemDevToolsOptions = {
  /**
   * Pass Expo FileSystem module from the host app.
   */
  expoFileSystem?: any;
  /**
   * Pass RNFS module from the host app.
   * Supports `react-native-fs` or `@dr.pogodin/react-native-fs` (same surface).
   */
  rnfs?: any;
};

async function detectProvider(
  options?: UseFileSystemDevToolsOptions,
): Promise<ProviderImpl | null> {
  if (!options?.expoFileSystem && !options?.rnfs) return null;

  if (options?.expoFileSystem) {
    const FileSystem =
      options.expoFileSystem?.default ?? options.expoFileSystem;
    const expo: ProviderImpl = {
      provider: 'expo',
      async getRoots() {
        const roots: Array<{ id: string; label: string; path: string }> = [];
        if (FileSystem.documentDirectory) {
          roots.push({
            id: 'expo.documentDirectory',
            label: 'Document Directory',
            path: normalizeDirPath(FileSystem.documentDirectory),
          });
        }
        if (FileSystem.cacheDirectory) {
          roots.push({
            id: 'expo.cacheDirectory',
            label: 'Cache Directory',
            path: normalizeDirPath(FileSystem.cacheDirectory),
          });
        }
        if (FileSystem.bundleDirectory) {
          roots.push({
            id: 'expo.bundleDirectory',
            label: 'Bundle Directory',
            path: normalizeDirPath(FileSystem.bundleDirectory),
          });
        }
        return roots;
      },
      async listDir(path) {
        const dir = normalizeDirPath(path);
        const rawItems: string[] = await FileSystem.readDirectoryAsync(dir);

        // Cache directories can be huge; avoid timeouts by limiting work.
        const MAX_ENTRIES = 400;
        const CONCURRENCY = 12;
        const limited = rawItems.slice(0, MAX_ENTRIES);

        const entries = await mapWithConcurrency(
          limited,
          CONCURRENCY,
          async (raw: string) => {
            const child = resolveExpoChildPath(dir, raw);
            const info = await FileSystem.getInfoAsync(child, { size: true });
            const isDirectory = Boolean(info.isDirectory);
            return {
              name: basename(raw),
              path: isDirectory ? normalizeDirPath(child) : child,
              isDirectory,
              size: info.size ?? null,
              modifiedAtMs:
                typeof info.modificationTime === 'number'
                  ? info.modificationTime * 1000
                  : null,
              mimeTypeHint: mimeTypeFromName(child),
            } satisfies FsEntry;
          },
        );

        if (rawItems.length > MAX_ENTRIES) {
          entries.push({
            name: `… (${rawItems.length - MAX_ENTRIES} more not shown)`,
            path: joinPath(dir, `__ROZENITE_TRUNCATED__${Date.now()}`),
            isDirectory: false,
            size: null,
            modifiedAtMs: null,
            mimeTypeHint: null,
          });
        }
        entries.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        return entries;
      },
      async readImageBase64(path, maxBytes) {
        const info = await FileSystem.getInfoAsync(path, { size: true });
        const size = info.size ?? 0;
        if (maxBytes > 0 && size > maxBytes) {
          throw new Error(
            `File is too large for preview (${size} bytes, limit ${maxBytes})`,
          );
        }
        const base64 = await FileSystem.readAsStringAsync(path, {
          encoding: 'base64',
        });
        const mime = mimeTypeFromName(path) ?? 'application/octet-stream';
        return { mime, base64 };
      },
      async readTextFile(path, maxBytes) {
        const info = await FileSystem.getInfoAsync(path, { size: true });
        const size = info.size ?? 0;
        if (maxBytes > 0 && size > maxBytes) {
          throw new Error(
            `File is too large for preview (${size} bytes, limit ${maxBytes})`,
          );
        }
        // Try UTF-8 first, fall back to base64 for binary files
        try {
          return await FileSystem.readAsStringAsync(path, { encoding: 'utf8' });
        } catch {
          // File might be binary, try base64
          const base64 = await FileSystem.readAsStringAsync(path, {
            encoding: 'base64',
          });
          // Decode base64 to show raw bytes as hex
          return (
            `[Binary file - ${size} bytes]\n\n` + formatBase64AsHex(base64)
          );
        }
      },
    };
    return expo;
  }

  const RNFS = options.rnfs;
  const rnfs: ProviderImpl = {
    provider: 'rnfs',
    async getRoots() {
      const roots: Array<{ id: string; label: string; path: string }> = [];
      roots.push({
        id: 'rnfs.DocumentDirectoryPath',
        label: 'Document Directory',
        path: normalizeDirPath(RNFS.DocumentDirectoryPath),
      });
      roots.push({
        id: 'rnfs.CachesDirectoryPath',
        label: 'Caches Directory',
        path: normalizeDirPath(RNFS.CachesDirectoryPath),
      });
      roots.push({
        id: 'rnfs.TemporaryDirectoryPath',
        label: 'Temporary Directory',
        path: normalizeDirPath(RNFS.TemporaryDirectoryPath),
      });
      roots.push({
        id: 'rnfs.LibraryDirectoryPath',
        label: 'Library Directory',
        path: normalizeDirPath(RNFS.LibraryDirectoryPath),
      });
      if (RNFS.MainBundlePath) {
        roots.push({
          id: 'rnfs.MainBundlePath',
          label: 'Main Bundle',
          path: normalizeDirPath(RNFS.MainBundlePath),
        });
      }
      return roots;
    },
    async listDir(path) {
      const normalized = normalizeDirPath(path);
      const dir =
        normalized.length > 1 && normalized.endsWith('/')
          ? normalized.slice(0, -1)
          : normalized;
      const items = await RNFS.readDir(dir);
      const entries: FsEntry[] = items.map((it: any) => {
        const isDirectory = it.isDirectory();
        return {
          name: it.name,
          path: isDirectory ? normalizeDirPath(it.path) : it.path,
          isDirectory,
          size: it.isFile() ? it.size : null,
          modifiedAtMs: it.mtime ? it.mtime.getTime() : null,
          mimeTypeHint: mimeTypeFromName(it.path),
        };
      });
      entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return entries;
    },
    async readImageBase64(path, maxBytes) {
      const st = await RNFS.stat(path);
      const size = st.size ?? 0;
      if (maxBytes > 0 && size > maxBytes) {
        throw new Error(
          `File is too large for preview (${size} bytes, limit ${maxBytes})`,
        );
      }
      const base64 = await RNFS.readFile(path, 'base64');
      const mime = mimeTypeFromName(path) ?? 'application/octet-stream';
      return { mime, base64 };
    },
    async readTextFile(path, maxBytes) {
      const st = await RNFS.stat(path);
      const size = st.size ?? 0;
      if (maxBytes > 0 && size > maxBytes) {
        throw new Error(
          `File is too large for preview (${size} bytes, limit ${maxBytes})`,
        );
      }
      // Try UTF-8 first, fall back to base64 for binary files
      try {
        return await RNFS.readFile(path, 'utf8');
      } catch {
        // File might be binary, try base64
        const base64 = await RNFS.readFile(path, 'base64');
        return `[Binary file - ${size} bytes]\n\n` + formatBase64AsHex(base64);
      }
    },
  };
  return rnfs;
}

function resolveExpoChildPath(dirUri: string, item: string): string {
  // Legacy FS can return either leaf names or full URIs/paths.
  if (!item) return dirUri;
  if (item.startsWith('file://')) return item;
  if (item.startsWith('/')) return item;
  if (item.startsWith(dirUri)) return item;
  return joinPath(dirUri, item);
}

function basename(pathOrUri: string): string {
  if (!pathOrUri) return '';
  // Strip query/hash for safety
  const clean = pathOrUri.split('?')[0].split('#')[0];
  const noTrailing = clean.endsWith('/') ? clean.slice(0, -1) : clean;
  const idx = noTrailing.lastIndexOf('/');
  return idx >= 0 ? noTrailing.slice(idx + 1) : noTrailing;
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results: TOutput[] = new Array(items.length);
  let idx = 0;

  const runners = new Array(Math.max(1, concurrency)).fill(0).map(async () => {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await worker(items[current]);
    }
  });

  await Promise.all(runners);
  return results;
}

function safeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function formatBase64AsHex(base64: string): string {
  // Decode base64 to bytes and format as hex dump
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];

  // Remove padding and decode
  const clean = base64.replace(/=/g, '');
  for (let i = 0; i < clean.length; i += 4) {
    const a = chars.indexOf(clean[i] || 'A');
    const b = chars.indexOf(clean[i + 1] || 'A');
    const c = chars.indexOf(clean[i + 2] || 'A');
    const d = chars.indexOf(clean[i + 3] || 'A');

    bytes.push((a << 2) | (b >> 4));
    if (i + 2 < clean.length) bytes.push(((b & 15) << 4) | (c >> 2));
    if (i + 3 < clean.length) bytes.push(((c & 3) << 6) | d);
  }

  // Limit to first 512 bytes for preview
  const limited = bytes.slice(0, 512);
  const lines: string[] = [];

  for (let i = 0; i < limited.length; i += 16) {
    const slice = limited.slice(i, i + 16);
    const hex = slice.map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = slice
      .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.'))
      .join('');
    const offset = i.toString(16).padStart(8, '0');
    lines.push(`${offset}  ${hex.padEnd(48)}  ${ascii}`);
  }

  if (bytes.length > 512) {
    lines.push(`\n... (${bytes.length - 512} more bytes not shown)`);
  }

  return lines.join('\n');
}

export const useFileSystemDevTools = (
  options?: UseFileSystemDevToolsOptions,
) => {
  const client = useRozeniteDevToolsClient<FileSystemEventMap>({
    pluginId: PLUGIN_ID,
  });

  const subsRef = useRef<Array<{ remove: () => void }>>([]);

  useEffect(() => {
    if (!client) return;

    // Notify the panel that the RN side is ready (handles app reload case)
    client.send('fs:ready', { timestamp: Date.now() });

    subsRef.current.push(
      client.onMessage('fs:get-roots', async ({ requestId }) => {
        try {
          const provider = await detectProvider(options);
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
          const provider = await detectProvider(options);
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
          const provider = await detectProvider(options);
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
            const provider = await detectProvider(options);
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
            const provider = await detectProvider(options);
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
            const provider = await detectProvider(options);
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
            const provider = await detectProvider(options);
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
  }, [client]);
};
