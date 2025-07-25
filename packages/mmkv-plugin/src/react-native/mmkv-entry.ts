import { MMKV } from 'react-native-mmkv';
import { MMKVEntry } from '../shared/types';

export const getMMKVEntry = (mmkv: MMKV, key: string): MMKVEntry => {
  const stringValue = mmkv.getString(key);

  if (stringValue !== undefined) {
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
      value: 'Binary data',
    };
  }

  throw new Error(`Unknown type for key: ${key}`);
};
