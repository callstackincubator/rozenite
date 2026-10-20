import type { StorageAdapter, StorageNode } from '../../shared/types';

export type KeychainLike = {
  getAllGenericPasswordServices(options?: { skipUIAuth?: boolean }): Promise<readonly string[]>;
  getGenericPassword(options: {
    service: string;
  }): Promise<false | { username: string; password: string; storage?: string }>;
  setGenericPassword(
    username: string,
    password: string,
    options?: { service?: string; [option: string]: unknown },
  ): Promise<unknown>;
  resetGenericPassword(options: { service: string }): Promise<unknown>;
};

type ServiceSource = readonly string[] | (() => Promise<readonly string[]>);

type SetOptionsSource =
  | Record<string, unknown>
  | ((service: string) => Record<string, unknown> | undefined);

export type CreateKeychainStorageAdapterOptions = {
  /** The `react-native-keychain` module. When it is missing the adapter exposes no storages. */
  keychain: KeychainLike | null | undefined;
  /** Services to show. Defaults to every service reported by `getAllGenericPasswordServices`. */
  services?: ServiceSource;
  /**
   * Skip services that need user authentication when listing them, so the panel does not
   * trigger biometric or passcode prompts (iOS). Ignored when `services` is set.
   * @default true
   */
  skipUIAuth?: boolean;
  /** Username stored with entries created from the panel. Existing entries keep their username. */
  defaultUsername?: string;
  /**
   * Options forwarded to `setGenericPassword`, such as `accessible` or `accessControl`.
   * The keychain does not report these for stored entries, so pass a function to return
   * the options each service was written with; otherwise edits re-save with these options.
   */
  setOptions?: SetOptionsSource;
  /** Disable add, edit, delete, purge and import in the panel and reject them on the device. */
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
  skipUIAuth = true,
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

  const resolveServices = async (): Promise<string[]> => {
    const resolved =
      typeof services === 'function'
        ? await services()
        : (services ?? (await keychain.getAllGenericPasswordServices({ skipUIAuth })));

    // iOS reports one service per Keychain item, so a service with several accounts repeats.
    return [...new Set(resolved)];
  };

  const readCredentials = async (service: string) => {
    try {
      return await keychain.getGenericPassword({ service });
    } catch (error) {
      // Entries behind biometrics, or with an invalidated Keystore key, cannot be read.
      console.warn(
        `[Rozenite] Storage Plugin: Could not read Keychain service "${service}".`,
        error,
      );
      return false;
    }
  };

  const isBlacklisted = (service: string) => {
    if (!blacklist) {
      return false;
    }

    blacklist.lastIndex = 0;
    return blacklist.test(service);
  };

  const resolveSetOptions = (service: string) =>
    typeof setOptions === 'function' ? setOptions(service) : setOptions;

  const storageNode: StorageNode = {
    id: storageId,
    name: storageName,
    blacklist,
    capabilities: {
      supportedTypes: ['string'],
      readOnly,
    },
    storage: {
      kind: 'async',
      getAllKeys: resolveServices,
      get: async (key) => {
        // Unreadable entries are skipped instead of failing the whole listing.
        const credentials = await readCredentials(key);
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
        if (entry.type !== 'string') {
          throw new Error('Keychain adapter supports only string values.');
        }

        // setGenericPassword replaces the whole entry, so keep the existing username and,
        // on Android, the storage type it was encrypted with. An unreadable entry is
        // overwritten with the defaults.
        const existing = await readCredentials(entry.key);
        const username = existing ? existing.username : defaultUsername;
        await keychain.setGenericPassword(username, entry.value, {
          ...(existing && existing.storage ? { storage: existing.storage } : {}),
          ...resolveSetOptions(entry.key),
          service: entry.key,
        });
      },
      delete: async (key) => {
        await keychain.resetGenericPassword({ service: key });
      },
      clear: async () => {
        // Only clear what the panel shows: hidden services stay untouched.
        const visible = (await resolveServices()).filter((service) => !isBlacklisted(service));
        const results = await Promise.allSettled(
          visible.map((service) => keychain.resetGenericPassword({ service })),
        );
        const failed = visible.filter((_, index) => results[index].status === 'rejected');
        if (failed.length > 0) {
          throw new Error(`Could not clear Keychain services: ${failed.join(', ')}.`);
        }
      },
    },
  };

  return {
    id: adapterId,
    name: adapterName,
    storages: [storageNode],
  };
};
