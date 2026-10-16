import type { StorageAdapter, StorageNode } from '../../shared/types';

export type KeychainLike = {
  getAllGenericPasswordServices(): Promise<readonly string[]>;
  getGenericPassword(options: {
    service: string;
  }): Promise<false | { username: string; password: string }>;
  setGenericPassword(
    username: string,
    password: string,
    options?: { service?: string; [option: string]: unknown },
  ): Promise<unknown>;
  resetGenericPassword(options: { service: string }): Promise<unknown>;
};

type ServiceSource = readonly string[] | (() => Promise<readonly string[]>);

export type CreateKeychainStorageAdapterOptions = {
  /** The `react-native-keychain` module. When it is missing the adapter exposes no storages. */
  keychain: KeychainLike | null | undefined;
  /** Services to show. Defaults to every service reported by `getAllGenericPasswordServices`. */
  services?: ServiceSource;
  /** Username stored with entries created from the panel. Existing entries keep their username. */
  defaultUsername?: string;
  /** Extra options forwarded to `setGenericPassword`, such as `accessible` or `accessControl`. */
  setOptions?: Record<string, unknown>;
  /** Reject set, delete and clear from the panel. */
  readOnly?: boolean;
  adapterId?: string;
  adapterName?: string;
  storageId?: string;
  storageName?: string;
  blacklist?: RegExp;
};

export const createKeychainStorageAdapter = ({
  keychain,
  services,
  defaultUsername = 'user',
  setOptions,
  readOnly = false,
  adapterId = 'react-native-keychain',
  adapterName = 'React Native Keychain',
  storageId = 'default',
  storageName = 'Keychain / Keystore',
  blacklist,
}: CreateKeychainStorageAdapterOptions): StorageAdapter => {
  if (!keychain) {
    return { id: adapterId, name: adapterName, storages: [] };
  }

  const resolveServices = async (): Promise<readonly string[]> => {
    if (typeof services === 'function') {
      return services();
    }

    return services ?? keychain.getAllGenericPasswordServices();
  };

  const assertWritable = () => {
    if (readOnly) {
      throw new Error('Keychain adapter is read-only.');
    }
  };

  const remove = async (service: string) => {
    assertWritable();
    await keychain.resetGenericPassword({ service });
  };

  const storageNode: StorageNode = {
    id: storageId,
    name: storageName,
    blacklist,
    capabilities: {
      supportedTypes: ['string'],
    },
    storage: {
      kind: 'async',
      getAllKeys: async () => [...(await resolveServices())],
      get: async (key) => {
        const credentials = await keychain.getGenericPassword({ service: key });
        if (!credentials) {
          return undefined;
        }

        return {
          key,
          type: 'string',
          value: credentials.password,
        };
      },
      set: async (entry) => {
        assertWritable();
        if (entry.type !== 'string') {
          throw new Error('Keychain adapter supports only string values.');
        }

        // setGenericPassword replaces the whole entry, so keep the existing username.
        const existing = await keychain.getGenericPassword({
          service: entry.key,
        });
        const username = existing ? existing.username : defaultUsername;
        await keychain.setGenericPassword(username, entry.value, {
          ...setOptions,
          service: entry.key,
        });
      },
      delete: remove,
      clear: async () => {
        assertWritable();
        const all = await resolveServices();
        await Promise.all(all.map(remove));
      },
    },
  };

  return {
    id: adapterId,
    name: adapterName,
    storages: [storageNode],
  };
};
