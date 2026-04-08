import { describe, expect, it, vi } from 'vitest';
import type { FsEntry } from '../shared/protocol';
import {
  createExpoFileSystemAdapter,
  createRNFSAdapter,
  resolveFileSystemAdapter,
  type ExpoFileSystemLike,
  type FileSystemAdapter,
  type RNFSLike,
} from '../react-native/fileSystemProvider';

const createExpoFileSystem = (): ExpoFileSystemLike => ({
  documentDirectory: 'file:///documents',
  cacheDirectory: 'file:///cache',
  bundleDirectory: 'file:///bundle',
  getInfoAsync: vi.fn(async (path: string) => {
    if (path === 'file:///documents') {
      return {
        exists: true,
        isDirectory: true,
        size: 20,
        modificationTime: 100,
      };
    }

    if (path === 'file:///documents/hello.txt') {
      return {
        exists: true,
        isDirectory: false,
        size: 5,
        modificationTime: 101,
      };
    }

    if (path === 'file:///documents/binary.bin') {
      return {
        exists: true,
        isDirectory: false,
        size: 4,
        modificationTime: 102,
      };
    }

    return {
      exists: true,
      isDirectory: true,
      size: 0,
      modificationTime: 100,
    };
  }),
  readDirectoryAsync: vi.fn(async () => ['hello.txt']),
  readAsStringAsync: vi.fn(
    async (path: string, options?: { encoding?: 'base64' | 'utf8' }) => {
      if (path === 'file:///documents/hello.txt') {
        return options?.encoding === 'base64' ? 'aGVsbG8=' : 'hello';
      }

      if (path === 'file:///documents/binary.bin' && options?.encoding === 'utf8') {
        throw new Error('Invalid UTF-8');
      }

      return 'AAECAw==';
    },
  ),
});

const createExpoModernFileSystem = (): ExpoFileSystemLike => {
  const pathInfo = vi.fn(async (path: string) => {
    if (path === 'file:///documents' || path === 'file:///documents/') {
      return { exists: true, isDirectory: true };
    }

    if (path === 'file:///documents/hello.txt') {
      return { exists: true, isDirectory: false };
    }

    if (path === 'file:///documents/binary.bin') {
      return { exists: true, isDirectory: false };
    }

    return { exists: true, isDirectory: true };
  });

  class MockDirectory {
    uri: string;
    name: string;
    constructor(path: string) {
      this.uri = path.endsWith('/') ? path : `${path}/`;
      const trimmed = this.uri.endsWith('/') ? this.uri.slice(0, -1) : this.uri;
      this.name = trimmed.slice(trimmed.lastIndexOf('/') + 1);
    }
    async info() {
      return {
        exists: true,
        modificationTime: 100,
      };
    }
    async list() {
      return [
        new MockFile('file:///documents/hello.txt'),
      ];
    }
  }

  class MockFile {
    uri: string;
    name: string;
    type: string | null;
    size: number;
    modificationTime: number;
    constructor(path: string) {
      this.uri = path;
      this.name = path.slice(path.lastIndexOf('/') + 1);
      this.type = path.endsWith('.png') ? 'image/png' : null;
      this.size = path.endsWith('.txt') ? 5 : 4;
      this.modificationTime = 101000;
    }
    async info() {
      return {
        exists: true,
        size: this.size,
        modificationTime: this.modificationTime,
      };
    }
    async text() {
      if (this.uri.endsWith('binary.bin')) {
        throw new Error('Invalid UTF-8');
      }
      return 'hello';
    }
    async base64() {
      return this.uri.endsWith('.txt') ? 'aGVsbG8=' : 'AAECAw==';
    }
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: {
      document: { uri: 'file:///documents' },
      cache: { uri: 'file:///cache' },
      bundle: { uri: 'file:///bundle' },
      info: pathInfo,
    },
    // Modern Expo still exposes deprecated functions that throw at runtime.
    readDirectoryAsync: vi.fn(async () => {
      throw new Error('deprecated');
    }),
    getInfoAsync: vi.fn(async () => {
      throw new Error('deprecated');
    }),
    readAsStringAsync: vi.fn(async () => {
      throw new Error('deprecated');
    }),
  };
};

const createRNFS = (): RNFSLike => ({
  DocumentDirectoryPath: '/documents',
  CachesDirectoryPath: '/cache',
  TemporaryDirectoryPath: '/tmp',
  LibraryDirectoryPath: '/library',
  MainBundlePath: '/bundle',
  readDir: vi.fn(async () => [
    {
      name: 'hello.txt',
      path: '/documents/hello.txt',
      size: 5,
      mtime: new Date(101000),
      isFile: () => true,
      isDirectory: () => false,
    },
  ]),
  stat: vi.fn(async (path: string) => ({
    size: path.endsWith('.txt') ? 5 : 4,
    mtime: new Date(100000),
    isFile: () => !path.endsWith('/'),
    isDirectory: () => path.endsWith('/'),
  })),
  readFile: vi.fn(async (path: string, encoding: 'base64' | 'utf8') => {
    if (path === '/documents/binary.bin' && encoding === 'utf8') {
      throw new Error('Invalid UTF-8');
    }

    if (encoding === 'base64') {
      return path.endsWith('.txt') ? 'aGVsbG8=' : 'AAECAw==';
    }

    return 'hello';
  }),
});

const createCustomAdapter = (): FileSystemAdapter => ({
  provider: 'rnfs',
  getRoots: vi.fn(async () => []),
  listDir: vi.fn(async () => []),
  statPath: vi.fn(async (path: string): Promise<FsEntry> => ({
    name: path,
    path,
    isDirectory: false,
    size: 0,
    modifiedAtMs: null,
    mimeTypeHint: null,
  })),
  readImageBase64: vi.fn(async () => ({
    mime: 'image/png',
    base64: 'ZmFrZQ==',
  })),
  readTextFile: vi.fn(async () => 'hello'),
});

describe('resolveFileSystemAdapter', () => {
  it('returns null when no provider is configured', async () => {
    await expect(resolveFileSystemAdapter()).resolves.toBeNull();
  });

  it('prefers a custom adapter over legacy options', async () => {
    const adapter = createCustomAdapter();
    const expoFileSystem = createExpoFileSystem();

    await expect(
      resolveFileSystemAdapter({ adapter, expoFileSystem }),
    ).resolves.toBe(adapter);
  });

  it('prefers expoFileSystem over rnfs when both legacy options are present', async () => {
    const resolved = await resolveFileSystemAdapter({
      expoFileSystem: createExpoFileSystem(),
      rnfs: createRNFS(),
    });

    expect(resolved?.provider).toBe('expo');
  });

  it('wraps rnfs when provided as the only legacy option', async () => {
    const resolved = await resolveFileSystemAdapter({
      rnfs: createRNFS(),
    });

    expect(resolved?.provider).toBe('rnfs');
  });

  it('prefers the modern Expo adapter when deprecated legacy methods are also present', async () => {
    const expoFileSystem = createExpoModernFileSystem();
    const resolved = await resolveFileSystemAdapter({
      expoFileSystem,
    });

    expect(resolved?.provider).toBe('expo');
    await expect(resolved?.listDir('file:///documents')).resolves.toEqual([
      {
        name: 'hello.txt',
        path: 'file:///documents/hello.txt',
        isDirectory: false,
        size: 5,
        modifiedAtMs: 101000,
        mimeTypeHint: null,
      },
    ]);
  });
});

describe('createExpoFileSystemAdapter', () => {
  it('returns expo roots and normalizes file metadata', async () => {
    const adapter = createExpoFileSystemAdapter(createExpoFileSystem());

    await expect(adapter.getRoots()).resolves.toEqual([
      {
        id: 'expo.documentDirectory',
        label: 'Document Directory',
        path: 'file:///documents/',
      },
      {
        id: 'expo.cacheDirectory',
        label: 'Cache Directory',
        path: 'file:///cache/',
      },
      {
        id: 'expo.bundleDirectory',
        label: 'Bundle Directory',
        path: 'file:///bundle/',
      },
    ]);

    await expect(adapter.listDir('file:///documents')).resolves.toEqual([
      {
        name: 'hello.txt',
        path: 'file:///documents/hello.txt',
        isDirectory: false,
        size: 5,
        modifiedAtMs: 101000,
        mimeTypeHint: null,
      },
    ]);
  });

  it('falls back to a hex preview for binary files', async () => {
    const adapter = createExpoFileSystemAdapter(createExpoFileSystem());

    await expect(
      adapter.readTextFile('file:///documents/binary.bin', 10),
    ).resolves.toContain('[Binary file - 4 bytes]');
  });

  it('rejects oversize previews', async () => {
    const adapter = createExpoFileSystemAdapter(createExpoFileSystem());

    await expect(
      adapter.readImageBase64('file:///documents/hello.txt', 1),
    ).rejects.toThrow('File is too large for preview');
  });

  it('supports the modern Expo FileSystem API', async () => {
    const adapter = createExpoFileSystemAdapter(createExpoModernFileSystem());

    await expect(adapter.getRoots()).resolves.toEqual([
      {
        id: 'expo.documentDirectory',
        label: 'Document Directory',
        path: 'file:///documents/',
      },
      {
        id: 'expo.cacheDirectory',
        label: 'Cache Directory',
        path: 'file:///cache/',
      },
      {
        id: 'expo.bundleDirectory',
        label: 'Bundle Directory',
        path: 'file:///bundle/',
      },
    ]);

    await expect(adapter.readTextFile('file:///documents/hello.txt', 10)).resolves.toBe(
      'hello',
    );

    await expect(
      adapter.readTextFile('file:///documents/binary.bin', 10),
    ).resolves.toContain('[Binary file - 4 bytes]');
  });
});

describe('createRNFSAdapter', () => {
  it('returns rnfs roots and normalizes file metadata', async () => {
    const adapter = createRNFSAdapter(createRNFS());

    await expect(adapter.getRoots()).resolves.toEqual([
      {
        id: 'rnfs.DocumentDirectoryPath',
        label: 'Document Directory',
        path: '/documents/',
      },
      {
        id: 'rnfs.CachesDirectoryPath',
        label: 'Caches Directory',
        path: '/cache/',
      },
      {
        id: 'rnfs.TemporaryDirectoryPath',
        label: 'Temporary Directory',
        path: '/tmp/',
      },
      {
        id: 'rnfs.LibraryDirectoryPath',
        label: 'Library Directory',
        path: '/library/',
      },
      {
        id: 'rnfs.MainBundlePath',
        label: 'Main Bundle',
        path: '/bundle/',
      },
    ]);

    await expect(adapter.listDir('/documents/')).resolves.toEqual([
      {
        name: 'hello.txt',
        path: '/documents/hello.txt',
        isDirectory: false,
        size: 5,
        modifiedAtMs: 101000,
        mimeTypeHint: null,
      },
    ]);
  });

  it('falls back to a hex preview for binary files', async () => {
    const adapter = createRNFSAdapter(createRNFS());

    await expect(
      adapter.readTextFile('/documents/binary.bin', 10),
    ).resolves.toContain('[Binary file - 4 bytes]');
  });

  it('rejects oversize previews', async () => {
    const adapter = createRNFSAdapter(createRNFS());

    await expect(
      adapter.readImageBase64('/documents/hello.txt', 1),
    ).rejects.toThrow('File is too large for preview');
  });
});
