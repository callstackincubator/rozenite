import { describe, expect, it, vi } from 'vitest';
import { createMMKVStorageAdapter } from '../mmkv';
import { createStorageViews } from '../../storage-view';

type StoredValue = string | number | boolean | ArrayBuffer;

const createFakeMMKVV3 = (id: string) => {
  const values = new Map<string, StoredValue>();

  return {
    id,
    set: vi.fn((key: string, value: StoredValue) => {
      values.set(key, value);
    }),
    getBoolean: vi.fn((key: string) => {
      const value = values.get(key);
      return typeof value === 'boolean' ? value : undefined;
    }),
    getString: vi.fn((key: string) => {
      const value = values.get(key);
      return typeof value === 'string' ? value : undefined;
    }),
    getNumber: vi.fn((key: string) => {
      const value = values.get(key);
      return typeof value === 'number' ? value : undefined;
    }),
    getBuffer: vi.fn((key: string) => {
      const value = values.get(key);
      return value instanceof ArrayBuffer ? value : undefined;
    }),
    delete: vi.fn((key: string) => {
      values.delete(key);
    }),
    getAllKeys: vi.fn(() => [...values.keys()]),
    addOnValueChangedListener: vi.fn(() => ({ remove: vi.fn() })),
  };
};

const createFakeMMKVV4 = () => {
  const values = new Map<string, StoredValue>();

  return {
    set: vi.fn((key: string, value: StoredValue) => {
      values.set(key, value);
    }),
    getBoolean: vi.fn((key: string) => {
      const value = values.get(key);
      return typeof value === 'boolean' ? value : undefined;
    }),
    getString: vi.fn((key: string) => {
      const value = values.get(key);
      return typeof value === 'string' ? value : undefined;
    }),
    getNumber: vi.fn((key: string) => {
      const value = values.get(key);
      return typeof value === 'number' ? value : undefined;
    }),
    getBuffer: vi.fn((key: string) => {
      const value = values.get(key);
      return value instanceof ArrayBuffer ? value : undefined;
    }),
    remove: vi.fn((key: string) => {
      values.delete(key);
    }),
    getAllKeys: vi.fn(() => [...values.keys()]),
    addOnValueChangedListener: vi.fn(() => ({ remove: vi.fn() })),
  };
};

describe('createMMKVStorageAdapter', () => {
  it('supports MMKV v3 storages passed as an array', async () => {
    const storage = createFakeMMKVV3('user-storage');
    const adapter = createMMKVStorageAdapter({ storages: [storage as any] });
    const [view] = createStorageViews([adapter]);

    await view.set({ key: 'theme', type: 'string', value: 'dark' });

    expect(view.target).toEqual({
      adapterId: 'mmkv',
      storageId: 'user-storage',
    });
    await expect(view.get('theme')).resolves.toEqual({
      key: 'theme',
      type: 'string',
      value: 'dark',
    });
  });

  it('supports MMKV v4 storages passed as a record', async () => {
    const storage = createFakeMMKVV4();
    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    await view.set({ key: 'logged-in', type: 'boolean', value: true });
    await expect(view.get('logged-in')).resolves.toEqual({
      key: 'logged-in',
      type: 'boolean',
      value: true,
    });

    await view.delete('logged-in');

    expect(storage.remove).toHaveBeenCalledWith('logged-in');
    await expect(view.get('logged-in')).resolves.toBeUndefined();
  });

  it('rejects MMKV v4 storages passed as an array', () => {
    const storage = createFakeMMKVV4();

    expect(() =>
      createMMKVStorageAdapter({ storages: [storage as any] }),
    ).toThrow(/MMKV arrays are not supported for v4 storages/);
  });

  it('applies global blacklist patterns against storageId:key', async () => {
    const userStorage = createFakeMMKVV3('user-storage');
    const cacheStorage = createFakeMMKVV3('cache-storage');

    userStorage.set('visible', 'ok');
    userStorage.set('secret', 'hide');
    cacheStorage.set('temp-file', 'hide');
    cacheStorage.set('persisted', 'ok');

    const adapter = createMMKVStorageAdapter({
      storages: [userStorage as any, cacheStorage as any],
      blacklist: /user-storage:secret|cache-storage:temp.*/,
    });

    const views = createStorageViews([adapter]);
    const userView = views.find(
      (view) => view.target.storageId === 'user-storage',
    );
    const cacheView = views.find(
      (view) => view.target.storageId === 'cache-storage',
    );

    expect(userView).toBeDefined();
    expect(cacheView).toBeDefined();

    await expect(userView?.getAllKeys()).resolves.toEqual(['visible']);
    await expect(cacheView?.getAllKeys()).resolves.toEqual(['persisted']);
  });
});

// MMKV in production stores raw bytes per key without a type tag, so
// getString returns data for any stored value whose bytes decode as
// valid UTF-8 — including values the app wrote via setBuffer. This
// fake mirrors that behaviour: getString attempts a strict UTF-8 decode
// and returns undefined when the bytes are not valid UTF-8, exposing
// the read priority chain that the adapter relies on.
//
// `lenientGetString`, when true, returns `""` instead of `undefined`
// on a failed UTF-8 decode — matching real MMKV builds on certain
// platforms (notably iOS NSString conversion). The adapter has to
// handle that case by falling through to getBuffer.
//
// `lenientGetNumber`, when true, reinterprets 8-byte buffer payloads
// as IEEE 754 doubles (instead of returning undefined). Some MMKV
// builds expose this behavior — without the buffer-before-number
// priority, the adapter would misreport such buffers as numbers.
const createAmbiguousFakeMMKVV4 = ({
  lenientGetString = false,
  lenientGetNumber = false,
}: { lenientGetString?: boolean; lenientGetNumber?: boolean } = {}) => {
  type Stored =
    | { kind: 'string'; value: string }
    | { kind: 'number'; value: number }
    | { kind: 'boolean'; value: boolean }
    | { kind: 'buffer'; bytes: Uint8Array };

  const values = new Map<string, Stored>();

  return {
    set: vi.fn(
      (key: string, value: string | number | boolean | ArrayBuffer) => {
        if (typeof value === 'string') {
          values.set(key, { kind: 'string', value });
        } else if (typeof value === 'number') {
          values.set(key, { kind: 'number', value });
        } else if (typeof value === 'boolean') {
          values.set(key, { kind: 'boolean', value });
        } else {
          values.set(key, {
            kind: 'buffer',
            bytes: new Uint8Array(value),
          });
        }
      },
    ),
    getString: vi.fn((key: string) => {
      const stored = values.get(key);
      if (!stored) return undefined;
      if (stored.kind === 'string') return stored.value;
      if (stored.kind === 'buffer') {
        try {
          return new TextDecoder('utf-8', { fatal: true }).decode(stored.bytes);
        } catch {
          return lenientGetString ? '' : undefined;
        }
      }
      return undefined;
    }),
    getNumber: vi.fn((key: string) => {
      const stored = values.get(key);
      if (stored?.kind === 'number') return stored.value;
      if (
        lenientGetNumber &&
        stored?.kind === 'buffer' &&
        stored.bytes.byteLength === 8
      ) {
        return new DataView(stored.bytes.buffer).getFloat64(0, true);
      }
      return undefined;
    }),
    getBoolean: vi.fn((key: string) => {
      const stored = values.get(key);
      return stored?.kind === 'boolean' ? stored.value : undefined;
    }),
    getBuffer: vi.fn((key: string) => {
      const stored = values.get(key);
      return stored?.kind === 'buffer' ? stored.bytes.buffer : undefined;
    }),
    remove: vi.fn((key: string) => {
      values.delete(key);
    }),
    getAllKeys: vi.fn(() => [...values.keys()]),
    addOnValueChangedListener: vi.fn(() => ({ remove: vi.fn() })),
  };
};

describe('createMMKVStorageAdapter read priority', () => {
  it('classifies a buffer of valid UTF-8 bytes as a string (documented limitation)', async () => {
    const storage = createAmbiguousFakeMMKVV4();
    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    // 0x68 0x65 0x6c 0x6c 0x6f = "hello" in ASCII. MMKV's getString
    // decodes the bytes as UTF-8 and we trust that report — users who
    // know the value is binary disambiguate at edit time via the Hex
    // editor.
    await view.set({
      key: 'token',
      type: 'buffer',
      value: [0x68, 0x65, 0x6c, 0x6c, 0x6f],
    });

    await expect(view.get('token')).resolves.toEqual({
      key: 'token',
      type: 'string',
      value: 'hello',
    });
  });

  it('classifies a buffer of non-UTF-8 bytes as a buffer', async () => {
    const storage = createAmbiguousFakeMMKVV4();
    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    // 0xFF 0xFE is invalid UTF-8 — getString returns undefined, the
    // chain falls through to getBuffer.
    await view.set({
      key: 'bin',
      type: 'buffer',
      value: [0xff, 0xfe, 0xfd],
    });

    await expect(view.get('bin')).resolves.toEqual({
      key: 'bin',
      type: 'buffer',
      value: [0xff, 0xfe, 0xfd],
    });
  });

  it('overwriting a buffer with a string returns the string on the next read', async () => {
    const storage = createAmbiguousFakeMMKVV4();
    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    await view.set({
      key: 'flip',
      type: 'buffer',
      value: [0xff, 0xfe],
    });
    await view.set({
      key: 'flip',
      type: 'string',
      value: 'world',
    });

    await expect(view.get('flip')).resolves.toEqual({
      key: 'flip',
      type: 'string',
      value: 'world',
    });
  });

  it('returns numbers via getNumber when no string is present at the key', async () => {
    const storage = createAmbiguousFakeMMKVV4();
    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    await view.set({ key: 'count', type: 'number', value: 42 });

    await expect(view.get('count')).resolves.toEqual({
      key: 'count',
      type: 'number',
      value: 42,
    });
  });

  it('returns booleans via getBoolean when no string or number is present at the key', async () => {
    const storage = createAmbiguousFakeMMKVV4();
    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    await view.set({ key: 'flag', type: 'boolean', value: true });

    await expect(view.get('flag')).resolves.toEqual({
      key: 'flag',
      type: 'boolean',
      value: true,
    });
  });

  it('deleting a key removes it from the storage view', async () => {
    const storage = createAmbiguousFakeMMKVV4();
    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    await view.set({ key: 'temp', type: 'string', value: 'hi' });
    await view.delete('temp');

    await expect(view.get('temp')).resolves.toBeUndefined();
  });
});

describe('createMMKVStorageAdapter read priority — lenient getString platforms', () => {
  // Real MMKV on some platforms returns `""` for invalid UTF-8 bytes
  // rather than `undefined`. Without the empty-string carve-out in the
  // priority chain, the adapter would misreport such buffers as empty
  // strings and the bytes would appear lost from the panel's POV.
  it('falls through to getBuffer when getString returns an empty string', async () => {
    const storage = createAmbiguousFakeMMKVV4({ lenientGetString: true });
    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    // PNG magic bytes — first byte (0x89) is an invalid UTF-8 lead.
    await view.set({
      key: 'png-magic',
      type: 'buffer',
      value: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    });

    await expect(view.get('png-magic')).resolves.toEqual({
      key: 'png-magic',
      type: 'buffer',
      value: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    });
  });

  it('preserves an intentional empty string when no buffer is present', async () => {
    const storage = createAmbiguousFakeMMKVV4({ lenientGetString: true });
    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    await view.set({ key: 'blank', type: 'string', value: '' });

    await expect(view.get('blank')).resolves.toEqual({
      key: 'blank',
      type: 'string',
      value: '',
    });
  });

  it('keeps an 8-byte buffer as buffer when getNumber lenient-decodes it as a double', async () => {
    // Some MMKV builds reinterpret 8-byte setBuffer payloads as IEEE
    // 754 doubles via getNumber. The priority chain has to consult
    // getBuffer before getNumber so the bytes that are actually on
    // disk win — otherwise PNG-magic-shaped buffers would be reported
    // as some arbitrary number.
    const storage = createAmbiguousFakeMMKVV4({
      lenientGetString: true,
      lenientGetNumber: true,
    });
    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    await view.set({ key: 'png-magic', type: 'buffer', value: pngMagic });

    await expect(view.get('png-magic')).resolves.toEqual({
      key: 'png-magic',
      type: 'buffer',
      value: pngMagic,
    });
  });

  it('reports an empty buffer as buffer (matching its setBuffer write)', async () => {
    const storage = createAmbiguousFakeMMKVV4({ lenientGetString: true });
    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    // 0xFF is invalid UTF-8 — getString returns "" under lenient decode.
    // The bytes are still present via getBuffer; we want the buffer
    // reading to win since byteLength > 0.
    await view.set({ key: 'invalid', type: 'buffer', value: [0xff] });

    await expect(view.get('invalid')).resolves.toEqual({
      key: 'invalid',
      type: 'buffer',
      value: [0xff],
    });
  });
});
