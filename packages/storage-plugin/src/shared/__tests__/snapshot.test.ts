import { describe, expect, it } from 'vitest';
import {
  buildSnapshot,
  computePreview,
  parseSnapshot,
  type StorageSnapshotV1,
} from '../snapshot';
import type {
  StorageCapabilities,
  StorageEntry,
  StorageTarget,
} from '../types';

const validSnapshot = (
  overrides: Partial<StorageSnapshotV1> = {},
): StorageSnapshotV1 => ({
  version: 1,
  plugin: '@rozenite/storage-plugin',
  createdAt: '2026-05-11T12:00:00.000Z',
  storage: {
    adapterId: 'mmkv',
    storageId: 'user',
    adapterName: 'MMKV',
    storageName: 'user',
    capabilities: { supportedTypes: ['string', 'number', 'boolean', 'buffer'] },
  },
  entries: [
    { key: 'token', type: 'string', value: 'abc' },
    { key: 'launchCount', type: 'number', value: 3 },
    { key: 'seenOnboarding', type: 'boolean', value: true },
    { key: 'blob', type: 'buffer', value: [1, 2, 255] },
  ],
  ...overrides,
});

describe('parseSnapshot', () => {
  it('accepts a valid snapshot covering all entry types', () => {
    const result = parseSnapshot(validSnapshot());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot).toEqual(validSnapshot());
    }
  });

  it('accepts a snapshot with an empty entries array', () => {
    const result = parseSnapshot(validSnapshot({ entries: [] }));
    expect(result.ok).toBe(true);
  });

  it('ignores unknown top-level fields (forward-tolerant)', () => {
    const input = { ...validSnapshot(), extraField: 'ignored' };
    const result = parseSnapshot(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot).not.toHaveProperty('extraField');
    }
  });

  describe('top-level rejections', () => {
    it.each([
      ['null', null],
      ['array', []],
      ['string', 'hi'],
      ['number', 1],
    ])('rejects non-object root (%s)', (_label, raw) => {
      const result = parseSnapshot(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.path).toBe('$');
      }
    });

    it('rejects when version is missing', () => {
      const snapshot = validSnapshot() as Record<string, unknown>;
      delete snapshot.version;
      const result = parseSnapshot(snapshot);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.path).toBe('version');
    });

    it.each([0, 2, '1', null])('rejects unsupported version: %s', (version) => {
      const result = parseSnapshot({ ...validSnapshot(), version });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.path).toBe('version');
        expect(result.error.message).toMatch(/version/i);
      }
    });

    it('rejects when plugin is not a string', () => {
      const result = parseSnapshot({ ...validSnapshot(), plugin: 42 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.path).toBe('plugin');
    });

    it('rejects when createdAt is not a string', () => {
      const result = parseSnapshot({ ...validSnapshot(), createdAt: 0 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.path).toBe('createdAt');
    });

    it('rejects when storage is missing', () => {
      const snapshot = validSnapshot() as Record<string, unknown>;
      delete snapshot.storage;
      const result = parseSnapshot(snapshot);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.path).toBe('storage');
    });

    it('rejects when entries is not an array', () => {
      const result = parseSnapshot({ ...validSnapshot(), entries: 'nope' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.path).toBe('entries');
    });

    it('rejects when capabilities.supportedTypes has an invalid type', () => {
      const snapshot = validSnapshot();
      const input = {
        ...snapshot,
        storage: {
          ...snapshot.storage,
          capabilities: { supportedTypes: ['string', 'date'] },
        },
      };
      const result = parseSnapshot(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.path).toBe(
          'storage.capabilities.supportedTypes[1]',
        );
      }
    });
  });

  describe('per-entry rejections', () => {
    const withEntry = (entry: unknown) =>
      parseSnapshot({ ...validSnapshot(), entries: [entry] });

    it('rejects entry missing key', () => {
      const result = withEntry({ type: 'string', value: 'x' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.path).toBe('entries[0].key');
    });

    it('rejects entry with unknown type', () => {
      const result = withEntry({ key: 'k', type: 'date', value: 'x' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.path).toBe('entries[0].type');
    });

    it('rejects string type with non-string value', () => {
      const result = withEntry({ key: 'k', type: 'string', value: 42 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.path).toBe('entries[0].value');
    });

    it('rejects number type with non-number value', () => {
      const result = withEntry({ key: 'k', type: 'number', value: '42' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.path).toBe('entries[0].value');
    });

    it.each([NaN, Infinity, -Infinity])(
      'rejects number type with non-finite value (%s)',
      (value) => {
        const result = withEntry({ key: 'k', type: 'number', value });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.path).toBe('entries[0].value');
      },
    );

    it('rejects boolean type with non-boolean value', () => {
      const result = withEntry({ key: 'k', type: 'boolean', value: 'true' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.path).toBe('entries[0].value');
    });

    it('rejects buffer type with non-array value', () => {
      const result = withEntry({ key: 'k', type: 'buffer', value: 'data' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.path).toBe('entries[0].value');
    });

    it.each([
      ['byte > 255', [1, 2, 256]],
      ['byte < 0', [1, -1]],
      ['non-integer byte', [1, 1.5]],
      ['NaN byte', [1, NaN]],
      ['non-number byte', [1, 'x']],
    ])('rejects buffer with invalid byte (%s)', (_label, value) => {
      const result = withEntry({ key: 'k', type: 'buffer', value });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.path).toMatch(/^entries\[0\]\.value\[\d+\]$/);
      }
    });

    it('produces a path-precise error for a nested failure', () => {
      const result = parseSnapshot({
        ...validSnapshot(),
        entries: [
          { key: 'a', type: 'string', value: 'ok' },
          { key: 'b', type: 'string', value: 'ok' },
          { key: 'c', type: 'string', value: 'ok' },
          { key: 'd', type: 'number', value: 'wrong' },
        ],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.path).toBe('entries[3].value');
    });
  });
});

describe('buildSnapshot', () => {
  it('produces a v1-shaped snapshot with the plugin id and an ISO createdAt', () => {
    const target: StorageTarget = { adapterId: 'mmkv', storageId: 'user' };
    const capabilities: StorageCapabilities = {
      supportedTypes: ['string', 'number'],
    };
    const entries: StorageEntry[] = [
      { key: 'token', type: 'string', value: 'abc' },
    ];

    const result = buildSnapshot({
      target,
      adapterName: 'MMKV',
      storageName: 'user',
      capabilities,
      entries,
    });

    expect(result.version).toBe(1);
    expect(result.plugin).toBe('@rozenite/storage-plugin');
    expect(() => new Date(result.createdAt).toISOString()).not.toThrow();
    expect(result.storage).toEqual({
      adapterId: 'mmkv',
      storageId: 'user',
      adapterName: 'MMKV',
      storageName: 'user',
      capabilities,
    });
    expect(result.entries).toBe(entries);
  });
});

describe('computePreview', () => {
  const target: StorageTarget = { adapterId: 'mmkv', storageId: 'user' };
  const allTypes: StorageCapabilities = {
    supportedTypes: ['string', 'number', 'boolean', 'buffer'],
  };
  const noBlacklist = () => false;

  it('splits entries into new vs overwrite', () => {
    const snapshot = validSnapshot({
      entries: [
        { key: 'existing', type: 'string', value: 'a' },
        { key: 'fresh', type: 'string', value: 'b' },
      ],
    });
    const preview = computePreview(snapshot, {
      target,
      capabilities: allTypes,
      entryKeys: new Set(['existing']),
      isBlacklisted: noBlacklist,
    });
    expect(preview.newKeys).toEqual(['fresh']);
    expect(preview.overwriteKeys).toEqual(['existing']);
  });

  it('surfaces blacklisted keys in skippedKeys', () => {
    const snapshot = validSnapshot({
      entries: [
        { key: 'visible', type: 'string', value: 'a' },
        { key: '__internal', type: 'string', value: 'b' },
      ],
    });
    const preview = computePreview(snapshot, {
      target,
      capabilities: allTypes,
      entryKeys: new Set(),
      isBlacklisted: (key) => key.startsWith('__'),
    });
    expect(preview.skippedKeys).toEqual([
      { key: '__internal', reason: 'blacklist' },
    ]);
    expect(preview.newKeys).toEqual(['visible']);
  });

  it('surfaces unsupported types', () => {
    const stringOnly: StorageCapabilities = { supportedTypes: ['string'] };
    const snapshot = validSnapshot({
      entries: [
        { key: 'ok', type: 'string', value: 'a' },
        { key: 'bad', type: 'buffer', value: [1, 2] },
      ],
    });
    const preview = computePreview(snapshot, {
      target,
      capabilities: stringOnly,
      entryKeys: new Set(),
      isBlacklisted: noBlacklist,
    });
    expect(preview.unsupportedTypes).toEqual([{ key: 'bad', type: 'buffer' }]);
    expect(preview.newKeys).toEqual(['ok']);
  });

  it('prioritises unsupportedTypes over blacklist over overwrite/new', () => {
    const stringOnly: StorageCapabilities = { supportedTypes: ['string'] };
    const snapshot = validSnapshot({
      entries: [
        { key: '__blocked', type: 'buffer', value: [1] }, // unsupported wins
        { key: '__skipped', type: 'string', value: 'a' }, // blacklist
        { key: 'existing', type: 'string', value: 'b' },
        { key: 'fresh', type: 'string', value: 'c' },
      ],
    });
    const preview = computePreview(snapshot, {
      target,
      capabilities: stringOnly,
      entryKeys: new Set(['existing']),
      isBlacklisted: (key) => key.startsWith('__'),
    });
    expect(preview.unsupportedTypes).toEqual([
      { key: '__blocked', type: 'buffer' },
    ]);
    expect(preview.skippedKeys).toEqual([
      { key: '__skipped', reason: 'blacklist' },
    ]);
    expect(preview.overwriteKeys).toEqual(['existing']);
    expect(preview.newKeys).toEqual(['fresh']);
  });

  it('flags metadataMismatch when adapter or storage IDs differ', () => {
    const snapshot = validSnapshot({
      storage: {
        adapterId: 'async-storage',
        storageId: 'default',
        adapterName: 'AsyncStorage',
        storageName: 'default',
        capabilities: allTypes,
      },
    });
    const preview = computePreview(snapshot, {
      target,
      capabilities: allTypes,
      entryKeys: new Set(),
      isBlacklisted: noBlacklist,
    });
    expect(preview.metadataMismatch).toBe(true);
  });

  it('reports metadataMismatch=false for matching target', () => {
    const preview = computePreview(validSnapshot(), {
      target,
      capabilities: allTypes,
      entryKeys: new Set(),
      isBlacklisted: noBlacklist,
    });
    expect(preview.metadataMismatch).toBe(false);
  });
});
