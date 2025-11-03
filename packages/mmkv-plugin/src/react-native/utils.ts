import type { MMKV as MMKVV3 } from 'react-native-mmkv-v3';
import type { MMKV as MMKVV4 } from 'react-native-mmkv-v4';

export type MMKV = MMKVV3 | MMKVV4;

export const isMMKVV4 = (mmkv: MMKV): mmkv is MMKVV4 => {
  // https://github.com/mrousavy/react-native-mmkv/blob/main/docs/V4_UPGRADE_GUIDE.md
  return 'remove' in mmkv;
};

export const normalizeStoragesConfigProperty = (
  storages: MMKV[] | Record<string, MMKV>
): Record<string, MMKV> => {
  if (Array.isArray(storages)) {
    const isAnyStorageV4 = storages.some(isMMKVV4);

    if (isAnyStorageV4) {
      // We need to throw in case of V4 as no storages will be reported back without the ID.
      throw new Error(
        '[Rozenite] MMKV DevTools: `storages` must be a record (object) of storage IDs and MMKV instances. Arrays are not supported in MMKV v4 because storage IDs are no longer accessible.'
      );
    }

    console.warn(
      '[Rozenite] MMKV DevTools: `storages` should be a record (object) of storage IDs and MMKV instances, not an array.'
    );

    return Object.fromEntries(
      (storages as MMKVV3[]).map((storage) => [storage['id'], storage])
    );
  }

  return storages;
};
