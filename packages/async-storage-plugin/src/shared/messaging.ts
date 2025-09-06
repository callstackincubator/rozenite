import { AsyncStorageEntry } from './types';

export type AsyncStorageEventMap = {
  // Host (React Native) to DevTools events
  'host-all-keys': string[];
  'host-entries': AsyncStorageEntry[];
  'host-entry-updated': {
    key: string;
    value: string;
  };
  
  // DevTools to Host (React Native) events
  'guest-get-all-keys': unknown;
  'guest-get-entries': {
    keys?: string[];
  };
  'guest-update-entry': {
    key: string;
    value: string;
  };
  'guest-remove-entry': {
    key: string;
  };
  'guest-clear-all': unknown;
};
