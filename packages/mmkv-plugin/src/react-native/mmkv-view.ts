import { MMKV } from 'react-native-mmkv';
import { MMKVEntry, MMKVEntryValue } from '../shared/types';
import { looksLikeGarbled } from './is-garbled';

export type MMKVView = {
  set: (key: string, value: MMKVEntryValue) => void;
  get: (key: string) => MMKVEntry | undefined;
  delete: (key: string) => void;
  getAllEntries: () => MMKVEntry[];
  getId: () => string;
  onChange: (callback: (key: string) => void) => { remove: () => void };
};

export const getMMKVView = (mmkv: MMKV, blacklist?: RegExp): MMKVView => {
  const storageId = mmkv['id'];

  // Helper function to check if a key should be blacklisted
  const isBlacklisted = (key: string): boolean => {
    if (!blacklist) return false;

    const fullKey = `${storageId}:${key}`;
    return blacklist.test(fullKey);
  };

  const mmkvView: MMKVView = {
    set: (key, value) => {
      if (Array.isArray(value)) {
        // This is a buffer representation, we need to convert it to an ArrayBuffer.
        mmkv.set(key, new Uint8Array(value).buffer);
        return;
      }

      mmkv.set(key, value);
    },
    get: (key: string) => {
      // Check if key is blacklisted
      if (isBlacklisted(key)) {
        return undefined;
      }

      // We are going to go through each type, one by one.
      // Ordering is important here!
      const stringValue = mmkv.getString(key);

      if (stringValue !== undefined && stringValue.length > 0) {
        if (looksLikeGarbled(stringValue)) {
          // This is most-likely a buffer as it contains non-printable characters
          return {
            key,
            type: 'buffer',
            value: Array.from(new TextEncoder().encode(stringValue)),
          };
        }

        return {
          key,
          type: 'string',
          value: stringValue,
        };
      }

      const numberValue = mmkv.getNumber(key);
      if (numberValue !== undefined) {
        return {
          key,
          type: 'number',
          value: numberValue,
        };
      }

      const booleanValue = mmkv.getBoolean(key);
      if (booleanValue !== undefined) {
        return {
          key,
          type: 'boolean',
          value: booleanValue,
        };
      }

      const bufferValue = mmkv.getBuffer(key);
      if (bufferValue !== undefined) {
        return {
          key,
          type: 'buffer',
          value: Array.from(new Uint8Array(bufferValue)),
        };
      }

      return undefined;
    },
    delete: (key: string) => mmkv.delete(key),
    getAllEntries: () => {
      return mmkv
        .getAllKeys()
        .filter((key) => !isBlacklisted(key))
        .map((key) => {
          const entry = mmkvView.get(key);
          if (!entry) {
            throw new Error(`Failed to get entry for key: ${key}`);
          }
          return entry;
        });
    },
    getId: () => storageId,
    onChange: (callback) => mmkv.addOnValueChangedListener(callback),
  };

  return mmkvView;
};
