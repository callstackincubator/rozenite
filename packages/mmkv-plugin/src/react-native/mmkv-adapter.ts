import type { MMKV as MMKVV3 } from 'react-native-mmkv-v3';
import type { MMKV as MMKVV4 } from 'react-native-mmkv-v4';
import { isMMKVV4 } from './utils';

export type MMKVAdapter = {
  set: (key: string, value: boolean | string | number | ArrayBuffer) => void;
  getBoolean: (key: string) => boolean | undefined;
  getString: (key: string) => string | undefined;
  getNumber: (key: string) => number | undefined;
  getBuffer: (key: string) => ArrayBuffer | undefined;
  delete: (key: string) => void;
  getAllKeys: () => string[];
  addOnValueChangedListener: (callback: (key: string) => void) => {
    remove: () => void;
  };
};

const getMMKVAdapterV3 = (mmkv: MMKVV3): MMKVAdapter => {
  return {
    set: (key, value) => mmkv.set(key, value),
    getBoolean: (key) => mmkv.getBoolean(key),
    getString: (key) => mmkv.getString(key),
    getNumber: (key) => mmkv.getNumber(key),
    getBuffer: (key) => mmkv.getBuffer(key) as ArrayBuffer | undefined,
    delete: (key) => mmkv.delete(key),
    getAllKeys: () => mmkv.getAllKeys(),
    addOnValueChangedListener: (callback) =>
      mmkv.addOnValueChangedListener(callback),
  };
};

const getMMKVAdapterV4 = (mmkv: MMKVV4): MMKVAdapter => {
  return {
    set: (key, value) => mmkv.set(key, value),
    getBoolean: (key) => mmkv.getBoolean(key),
    getString: (key) => mmkv.getString(key),
    getNumber: (key) => mmkv.getNumber(key),
    getBuffer: (key) => mmkv.getBuffer(key),
    delete: (key) => mmkv.remove(key),
    getAllKeys: () => mmkv.getAllKeys(),
    addOnValueChangedListener: (callback) =>
      mmkv.addOnValueChangedListener(callback),
  };
};

export const getMMKVAdapter = (mmkv: MMKVV3 | MMKVV4): MMKVAdapter => {
  if (isMMKVV4(mmkv)) {
    return getMMKVAdapterV4(mmkv);
  }

  return getMMKVAdapterV3(mmkv);
};
