import { MMKVEntry, MMKVEntryValue } from './types';

export type MMKVEventMap = {
  'host-entry-updated': {
    instanceId: string;
    key: string;
    value: MMKVEntryValue;
  };
  'host-instances': string[];
  'host-entries': {
    instanceId: string;
    entries: MMKVEntry[];
  };

  'guest-get-instances': unknown;
  'guest-get-entries': {
    instanceId: string;
  };
  'guest-update-entry': {
    instanceId: string;
    key: string;
    value: MMKVEntryValue;
  };
};
