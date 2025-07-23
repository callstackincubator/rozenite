export type MMKVEventMap = {
  'add-instance': {
    instanceId: string;
  },
  'get-instances': unknown;
  'instances': string[];
  'get-entries': {
    instanceId: string;
  };
  'entries': {
    instanceId: string;
    entries: MMKVEntry[];
  };
}

export type MMKVEntry = {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'buffer';
  value: string | number | boolean | string; // buffer is base64 encoded string
}