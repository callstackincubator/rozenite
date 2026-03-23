import type { FileSystemProvider, FsEntry } from '../shared/protocol';
import {
  joinPath,
  mimeTypeFromName,
  normalizeDirPath,
} from '../shared/path';

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

export type FileSystemRoot = {
  id: string;
  label: string;
  path: string;
};

export type ProviderImpl = {
  provider: Exclude<FileSystemProvider, 'none'>;
  getRoots: () => Promise<FileSystemRoot[]>;
  listDir: (path: string) => Promise<FsEntry[]>;
  statPath: (path: string) => Promise<FsEntry>;
  readImageBase64: (
    path: string,
    maxBytes: number,
  ) => Promise<{ mime: string; base64: string }>;
  readTextFile: (path: string, maxBytes: number) => Promise<string>;
};

export async function detectProvider(
  options?: UseFileSystemDevToolsOptions,
): Promise<ProviderImpl | null> {
  if (!options?.expoFileSystem && !options?.rnfs) return null;

  if (options?.expoFileSystem) {
    const FileSystem =
      options.expoFileSystem?.default ?? options.expoFileSystem;

    const buildEntry = async (rawPath: string): Promise<FsEntry> => {
      const info = await FileSystem.getInfoAsync(rawPath, { size: true });

      if (!info.exists) {
        throw new Error(`Path "${rawPath}" does not exist.`);
      }

      const isDirectory = Boolean(info.isDirectory);
      const normalizedPath = isDirectory ? normalizeDirPath(rawPath) : rawPath;

      return {
        name: basename(rawPath),
        path: normalizedPath,
        isDirectory,
        size: info.size ?? null,
        modifiedAtMs:
          typeof info.modificationTime === 'number'
            ? info.modificationTime * 1000
            : null,
        mimeTypeHint: mimeTypeFromName(rawPath),
      };
    };

    const expo: ProviderImpl = {
      provider: 'expo',
      async getRoots() {
        const roots: FileSystemRoot[] = [];
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

        const MAX_ENTRIES = 400;
        const CONCURRENCY = 12;
        const limited = rawItems.slice(0, MAX_ENTRIES);

        const entries = await mapWithConcurrency(
          limited,
          CONCURRENCY,
          async (raw: string) => {
            const child = resolveExpoChildPath(dir, raw);
            return buildEntry(child);
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
      async statPath(path) {
        return buildEntry(path);
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
        try {
          return await FileSystem.readAsStringAsync(path, { encoding: 'utf8' });
        } catch {
          const base64 = await FileSystem.readAsStringAsync(path, {
            encoding: 'base64',
          });
          return `[Binary file - ${size} bytes]\n\n` + formatBase64AsHex(base64);
        }
      },
    };

    return expo;
  }

  const RNFS = options.rnfs;
  const rnfs: ProviderImpl = {
    provider: 'rnfs',
    async getRoots() {
      const roots: FileSystemRoot[] = [];
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
      const dir = normalizeRnfsPath(path);
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
    async statPath(path) {
      const normalizedPath = normalizeRnfsPath(path);
      const stat = await RNFS.stat(normalizedPath);
      const isDirectory = isRnfsDirectory(stat);

      return {
        name: basename(path),
        path: isDirectory ? normalizeDirPath(normalizedPath) : normalizedPath,
        isDirectory,
        size: isDirectory ? null : stat.size ?? null,
        modifiedAtMs: stat.mtime ? new Date(stat.mtime).getTime() : null,
        mimeTypeHint: mimeTypeFromName(normalizedPath),
      };
    },
    async readImageBase64(path, maxBytes) {
      const normalizedPath = normalizeRnfsPath(path);
      const st = await RNFS.stat(normalizedPath);
      const size = st.size ?? 0;
      if (maxBytes > 0 && size > maxBytes) {
        throw new Error(
          `File is too large for preview (${size} bytes, limit ${maxBytes})`,
        );
      }
      const base64 = await RNFS.readFile(normalizedPath, 'base64');
      const mime = mimeTypeFromName(path) ?? 'application/octet-stream';
      return { mime, base64 };
    },
    async readTextFile(path, maxBytes) {
      const normalizedPath = normalizeRnfsPath(path);
      const st = await RNFS.stat(normalizedPath);
      const size = st.size ?? 0;
      if (maxBytes > 0 && size > maxBytes) {
        throw new Error(
          `File is too large for preview (${size} bytes, limit ${maxBytes})`,
        );
      }
      try {
        return await RNFS.readFile(normalizedPath, 'utf8');
      } catch {
        const base64 = await RNFS.readFile(normalizedPath, 'base64');
        return `[Binary file - ${size} bytes]\n\n` + formatBase64AsHex(base64);
      }
    },
  };
  return rnfs;
}

export function safeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function resolveExpoChildPath(dirUri: string, item: string): string {
  if (!item) return dirUri;
  if (item.startsWith('file://')) return item;
  if (item.startsWith('/')) return item;
  if (item.startsWith(dirUri)) return item;
  return joinPath(dirUri, item);
}

function basename(pathOrUri: string): string {
  if (!pathOrUri) return '';
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

function formatBase64AsHex(base64: string): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];

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

function normalizeRnfsPath(path: string): string {
  if (!path) return path;
  if (path === '/') return path;
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

function isRnfsDirectory(stat: any): boolean {
  if (typeof stat?.isDirectory === 'function') {
    return stat.isDirectory();
  }
  return stat?.type === 'directory';
}
