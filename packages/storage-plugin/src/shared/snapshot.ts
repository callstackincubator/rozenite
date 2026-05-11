import {
  DEFAULT_SUPPORTED_TYPES,
  supportsType,
  type StorageCapabilities,
  type StorageEntry,
  type StorageEntryType,
  type StorageTarget,
} from './types';

const PLUGIN_ID = '@rozenite/storage-plugin';
const SUPPORTED_VERSION = 1;

export type StorageSnapshotV1 = {
  version: 1;
  plugin: string;
  createdAt: string;
  storage: {
    adapterId: string;
    storageId: string;
    adapterName: string;
    storageName: string;
    capabilities: StorageCapabilities;
  };
  entries: StorageEntry[];
};

export type ParseError = { path: string; message: string };

export type ParseResult =
  | { ok: true; snapshot: StorageSnapshotV1 }
  | { ok: false; error: ParseError };

class ParseException extends Error {
  constructor(
    public path: string,
    message: string,
  ) {
    super(message);
  }
}

const describe = (value: unknown): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const expectObject = (
  value: unknown,
  path: string,
): Record<string, unknown> => {
  if (!isPlainObject(value)) {
    throw new ParseException(path, `Expected object, got ${describe(value)}`);
  }
  return value;
};

const expectString = (value: unknown, path: string): string => {
  if (typeof value !== 'string') {
    throw new ParseException(path, `Expected string, got ${describe(value)}`);
  }
  return value;
};

const expectArray = (value: unknown, path: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new ParseException(path, `Expected array, got ${describe(value)}`);
  }
  return value;
};

const expectEntryType = (value: unknown, path: string): StorageEntryType => {
  if (
    typeof value !== 'string' ||
    !DEFAULT_SUPPORTED_TYPES.includes(value as StorageEntryType)
  ) {
    throw new ParseException(
      path,
      `Expected one of ${DEFAULT_SUPPORTED_TYPES.join(', ')}, got ${describe(value)}`,
    );
  }
  return value as StorageEntryType;
};

const parseCapabilities = (raw: unknown, path: string): StorageCapabilities => {
  const obj = expectObject(raw, path);
  const supported = expectArray(obj.supportedTypes, `${path}.supportedTypes`);
  const supportedTypes = supported.map((type, index) =>
    expectEntryType(type, `${path}.supportedTypes[${index}]`),
  );
  return { supportedTypes };
};

const parseStorageMeta = (raw: unknown): StorageSnapshotV1['storage'] => {
  const obj = expectObject(raw, 'storage');
  return {
    adapterId: expectString(obj.adapterId, 'storage.adapterId'),
    storageId: expectString(obj.storageId, 'storage.storageId'),
    adapterName: expectString(obj.adapterName, 'storage.adapterName'),
    storageName: expectString(obj.storageName, 'storage.storageName'),
    capabilities: parseCapabilities(obj.capabilities, 'storage.capabilities'),
  };
};

const parseEntry = (raw: unknown, path: string): StorageEntry => {
  const obj = expectObject(raw, path);
  const key = expectString(obj.key, `${path}.key`);
  const type = expectEntryType(obj.type, `${path}.type`);
  const valuePath = `${path}.value`;

  switch (type) {
    case 'string': {
      const value = obj.value;
      if (typeof value !== 'string') {
        throw new ParseException(
          valuePath,
          `Expected string for type "string", got ${describe(value)}`,
        );
      }
      return { key, type: 'string', value };
    }
    case 'number': {
      const value = obj.value;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new ParseException(
          valuePath,
          `Expected finite number for type "number", got ${describe(value)}`,
        );
      }
      return { key, type: 'number', value };
    }
    case 'boolean': {
      const value = obj.value;
      if (typeof value !== 'boolean') {
        throw new ParseException(
          valuePath,
          `Expected boolean for type "boolean", got ${describe(value)}`,
        );
      }
      return { key, type: 'boolean', value };
    }
    case 'buffer': {
      const value = obj.value;
      if (!Array.isArray(value)) {
        throw new ParseException(
          valuePath,
          `Expected number[] for type "buffer", got ${describe(value)}`,
        );
      }
      const bytes = value.map((byte, index) => {
        if (
          typeof byte !== 'number' ||
          !Number.isInteger(byte) ||
          byte < 0 ||
          byte > 255
        ) {
          throw new ParseException(
            `${valuePath}[${index}]`,
            `Expected uint8 (integer 0-255), got ${describe(byte)}`,
          );
        }
        return byte;
      });
      return { key, type: 'buffer', value: bytes };
    }
  }
};

export const parseSnapshot = (raw: unknown): ParseResult => {
  try {
    const root = expectObject(raw, '$');
    const version = root.version;
    if (version !== SUPPORTED_VERSION) {
      throw new ParseException(
        'version',
        `Unsupported snapshot version: ${describe(version)} (this build supports version ${SUPPORTED_VERSION})`,
      );
    }
    const plugin = expectString(root.plugin, 'plugin');
    const createdAt = expectString(root.createdAt, 'createdAt');
    const storage = parseStorageMeta(root.storage);
    const rawEntries = expectArray(root.entries, 'entries');
    const entries = rawEntries.map((entry, index) =>
      parseEntry(entry, `entries[${index}]`),
    );
    return {
      ok: true,
      snapshot: {
        version: SUPPORTED_VERSION,
        plugin,
        createdAt,
        storage,
        entries,
      },
    };
  } catch (error) {
    if (error instanceof ParseException) {
      return { ok: false, error: { path: error.path, message: error.message } };
    }
    throw error;
  }
};

export const buildSnapshot = (args: {
  target: StorageTarget;
  adapterName: string;
  storageName: string;
  capabilities: StorageCapabilities;
  entries: StorageEntry[];
}): StorageSnapshotV1 => ({
  version: 1,
  plugin: PLUGIN_ID,
  createdAt: new Date().toISOString(),
  storage: {
    adapterId: args.target.adapterId,
    storageId: args.target.storageId,
    adapterName: args.adapterName,
    storageName: args.storageName,
    capabilities: args.capabilities,
  },
  entries: args.entries,
});

export type ImportPreview = {
  newKeys: string[];
  overwriteKeys: string[];
  skippedKeys: { key: string; reason: 'blacklist' }[];
  unsupportedTypes: { key: string; type: StorageEntryType }[];
  metadataMismatch: boolean;
};

export const computePreview = (
  snapshot: StorageSnapshotV1,
  current: {
    target: StorageTarget;
    capabilities: StorageCapabilities;
    entryKeys: Set<string>;
    isBlacklisted: (key: string) => boolean;
  },
): ImportPreview => {
  const newKeys: string[] = [];
  const overwriteKeys: string[] = [];
  const skippedKeys: { key: string; reason: 'blacklist' }[] = [];
  const unsupportedTypes: { key: string; type: StorageEntryType }[] = [];

  for (const entry of snapshot.entries) {
    if (!supportsType(current.capabilities, entry.type)) {
      unsupportedTypes.push({ key: entry.key, type: entry.type });
      continue;
    }
    if (current.isBlacklisted(entry.key)) {
      skippedKeys.push({ key: entry.key, reason: 'blacklist' });
      continue;
    }
    if (current.entryKeys.has(entry.key)) {
      overwriteKeys.push(entry.key);
    } else {
      newKeys.push(entry.key);
    }
  }

  const metadataMismatch =
    snapshot.storage.adapterId !== current.target.adapterId ||
    snapshot.storage.storageId !== current.target.storageId;

  return {
    newKeys,
    overwriteKeys,
    skippedKeys,
    unsupportedTypes,
    metadataMismatch,
  };
};
