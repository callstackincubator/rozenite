import { describe, expect, it, vi } from 'vitest';
import type { FsEntry } from '../shared/protocol';
import type { ProviderImpl } from '../react-native/fileSystemProvider';
import {
  createFileSystemAgentHandlers,
  FILE_SYSTEM_AGENT_PLUGIN_ID,
  fileSystemAgentTools,
} from '../react-native/useFileSystemAgentTools';

const createEntry = (overrides?: Partial<FsEntry>): FsEntry => ({
  name: 'sample.txt',
  path: '/tmp/sample.txt',
  isDirectory: false,
  size: 12,
  modifiedAtMs: 123,
  mimeTypeHint: null,
  ...overrides,
});

const createProvider = (
  overrides?: Partial<ProviderImpl>,
  entries: FsEntry[] = [],
): ProviderImpl => ({
  provider: 'expo',
  getRoots: vi.fn(async () => [
    {
      id: 'expo.documentDirectory',
      label: 'Document Directory',
      path: 'file:///documents/',
    },
  ]),
  listDir: vi.fn(async () => entries),
  statPath: vi.fn(async (path: string) =>
    entries.find((entry) => entry.path === path) ?? createEntry({ path })
  ),
  readImageBase64: vi.fn(async () => ({
    mime: 'image/png',
    base64: 'ZmFrZQ==',
  })),
  readTextFile: vi.fn(async () => 'hello world'),
  ...overrides,
});

describe('file system agent tools', () => {
  it('uses the public plugin ID and exposes the expected tool names', () => {
    expect(FILE_SYSTEM_AGENT_PLUGIN_ID).toBe('@rozenite/file-system-plugin');
    expect(fileSystemAgentTools.map((tool) => tool.name)).toEqual([
      'list-roots',
      'list-entries',
      'read-entry',
      'read-text-file',
      'read-image-file',
    ]);
  });

  it('declares required schema fields for path-based tools', () => {
    const listEntries = fileSystemAgentTools.find(
      (tool) => tool.name === 'list-entries',
    );
    const readEntry = fileSystemAgentTools.find(
      (tool) => tool.name === 'read-entry',
    );
    const readTextFile = fileSystemAgentTools.find(
      (tool) => tool.name === 'read-text-file',
    );
    const readImageFile = fileSystemAgentTools.find(
      (tool) => tool.name === 'read-image-file',
    );

    expect(listEntries?.inputSchema.required).toEqual(['path']);
    expect(readEntry?.inputSchema.required).toEqual(['path']);
    expect(readTextFile?.inputSchema.required).toEqual(['path']);
    expect(readImageFile?.inputSchema.required).toEqual(['path']);
  });
});

describe('createFileSystemAgentHandlers', () => {
  it('returns provider none and no roots when no filesystem provider is configured', async () => {
    const handlers = createFileSystemAgentHandlers(async () => null);

    await expect(handlers.listRoots()).resolves.toEqual({
      provider: 'none',
      roots: [],
    });
  });

  it('lists roots for the active provider', async () => {
    const provider = createProvider();
    const handlers = createFileSystemAgentHandlers(async () => provider);

    await expect(handlers.listRoots()).resolves.toEqual({
      provider: 'expo',
      roots: [
        {
          id: 'expo.documentDirectory',
          label: 'Document Directory',
          path: 'file:///documents/',
        },
      ],
    });
  });

  it('lists directory entries with pagination', async () => {
    const entries = [
      createEntry({ name: 'a.txt', path: '/tmp/a.txt' }),
      createEntry({ name: 'b.txt', path: '/tmp/b.txt' }),
      createEntry({ name: 'c.txt', path: '/tmp/c.txt' }),
    ];
    const provider = createProvider(undefined, entries);
    const handlers = createFileSystemAgentHandlers(async () => provider);

    await expect(
      handlers.listEntries({ path: '/tmp/', offset: 1, limit: 1 }),
    ).resolves.toEqual({
      provider: 'expo',
      path: '/tmp/',
      total: 3,
      offset: 1,
      limit: 1,
      entries: [entries[1]],
    });
  });

  it('fails when listing entries without a provider', async () => {
    const handlers = createFileSystemAgentHandlers(async () => null);

    await expect(handlers.listEntries({ path: '/tmp/' })).rejects.toThrow(
      'No filesystem provider detected.',
    );
  });

  it('surfaces directory listing errors', async () => {
    const provider = createProvider({
      listDir: vi.fn(async () => {
        throw new Error('Permission denied');
      }),
    });
    const handlers = createFileSystemAgentHandlers(async () => provider);

    await expect(handlers.listEntries({ path: '/private/' })).rejects.toThrow(
      'Permission denied',
    );
  });

  it('reads entry metadata for files and directories', async () => {
    const fileEntry = createEntry({ path: '/tmp/file.txt' });
    const dirEntry = createEntry({
      name: 'folder',
      path: '/tmp/folder/',
      isDirectory: true,
      size: null,
    });
    const provider = createProvider(undefined, [fileEntry, dirEntry]);
    const handlers = createFileSystemAgentHandlers(async () => provider);

    await expect(handlers.readEntry({ path: '/tmp/file.txt' })).resolves.toEqual(
      {
        provider: 'expo',
        path: '/tmp/file.txt',
        entry: fileEntry,
      },
    );

    await expect(handlers.readEntry({ path: '/tmp/folder/' })).resolves.toEqual(
      {
        provider: 'expo',
        path: '/tmp/folder/',
        entry: dirEntry,
      },
    );
  });

  it('surfaces missing path errors from stat lookups', async () => {
    const provider = createProvider({
      statPath: vi.fn(async () => {
        throw new Error('Path "/missing" does not exist.');
      }),
    });
    const handlers = createFileSystemAgentHandlers(async () => provider);

    await expect(handlers.readEntry({ path: '/missing' })).rejects.toThrow(
      'Path "/missing" does not exist.',
    );
  });

  it('reads text file previews', async () => {
    const provider = createProvider(undefined, [
      createEntry({ path: '/tmp/note.txt', size: 42 }),
    ]);
    const handlers = createFileSystemAgentHandlers(async () => provider);

    await expect(
      handlers.readTextFile({ path: '/tmp/note.txt', maxBytes: 256 }),
    ).resolves.toEqual({
      provider: 'expo',
      path: '/tmp/note.txt',
      mimeTypeHint: null,
      size: 42,
      content: 'hello world',
    });
  });

  it('supports binary fallback text previews through the provider', async () => {
    const provider = createProvider({
      readTextFile: vi.fn(async () => '[Binary file - 4 bytes]\n\n00 01 02 03'),
    }, [createEntry({ path: '/tmp/binary.bin', name: 'binary.bin', size: 4 })]);
    const handlers = createFileSystemAgentHandlers(async () => provider);

    await expect(
      handlers.readTextFile({ path: '/tmp/binary.bin' }),
    ).resolves.toMatchObject({
      provider: 'expo',
      path: '/tmp/binary.bin',
      content: '[Binary file - 4 bytes]\n\n00 01 02 03',
    });
  });

  it('surfaces oversize text preview errors', async () => {
    const provider = createProvider({
      readTextFile: vi.fn(async () => {
        throw new Error('File is too large for preview (11 bytes, limit 10)');
      }),
    }, [createEntry({ path: '/tmp/large.txt', size: 11 })]);
    const handlers = createFileSystemAgentHandlers(async () => provider);

    await expect(
      handlers.readTextFile({ path: '/tmp/large.txt', maxBytes: 10 }),
    ).rejects.toThrow('File is too large for preview');
  });

  it('rejects text preview requests for directories', async () => {
    const provider = createProvider(undefined, [
      createEntry({
        path: '/tmp/folder/',
        name: 'folder',
        isDirectory: true,
        size: null,
      }),
    ]);
    const handlers = createFileSystemAgentHandlers(async () => provider);

    await expect(
      handlers.readTextFile({ path: '/tmp/folder/' }),
    ).rejects.toThrow('is a directory, not a file');
  });

  it('reads image previews', async () => {
    const provider = createProvider(undefined, [
      createEntry({
        path: '/tmp/photo.png',
        name: 'photo.png',
        mimeTypeHint: 'image/png',
        size: 128,
      }),
    ]);
    const handlers = createFileSystemAgentHandlers(async () => provider);

    await expect(
      handlers.readImageFile({ path: '/tmp/photo.png', maxBytes: 1024 }),
    ).resolves.toEqual({
      provider: 'expo',
      path: '/tmp/photo.png',
      mimeTypeHint: 'image/png',
      size: 128,
      dataUri: 'data:image/png;base64,ZmFrZQ==',
    });
  });

  it('surfaces oversize image preview errors', async () => {
    const provider = createProvider({
      readImageBase64: vi.fn(async () => {
        throw new Error('File is too large for preview (101 bytes, limit 100)');
      }),
    }, [
      createEntry({
        path: '/tmp/photo.png',
        name: 'photo.png',
        mimeTypeHint: 'image/png',
        size: 101,
      }),
    ]);
    const handlers = createFileSystemAgentHandlers(async () => provider);

    await expect(
      handlers.readImageFile({ path: '/tmp/photo.png', maxBytes: 100 }),
    ).rejects.toThrow('File is too large for preview');
  });
});
