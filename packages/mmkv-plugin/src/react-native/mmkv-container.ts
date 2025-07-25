import { createNanoEvents, Unsubscribe } from 'nanoevents';
import { MMKV } from 'react-native-mmkv';

export type MMKVContainerEvents = {
  'value-changed': (instanceId: string, key: string) => void;
  'instance-created': (instanceId: string) => void;
};

export type MMKVContainer = {
  getInstanceIds: () => string[];
  getInstance: (instanceId: string) => MMKV | null;
  on: <T extends keyof MMKVContainerEvents>(
    event: T,
    listener: MMKVContainerEvents[T]
  ) => Unsubscribe;
};

export const getMMKVContainer = (): MMKVContainer => {
  const instances: Map<string, MMKV> = new Map();
  const eventEmitter = createNanoEvents<MMKVContainerEvents>();

  const handleValueChanged = (instanceId: string) => (key: string) => {
    eventEmitter.emit('value-changed', instanceId, key);
  };

  const register = (id: string, mmkv: MMKV): void => {
    instances.set(id, mmkv);
    eventEmitter.emit('instance-created', id);
    mmkv.addOnValueChangedListener(handleValueChanged(id));
  };

  Object.defineProperty(MMKV.prototype, 'id', {
    get() {
      return this._id;
    },
    set(value) {
      register(value, this);
      this._id = value;
    },
  });

  return {
    getInstanceIds: () => Array.from(instances.keys()),
    getInstance: (instanceId: string) => instances.get(instanceId) ?? null,
    on: eventEmitter.on.bind(eventEmitter),
  };
};
