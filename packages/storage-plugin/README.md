![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin for inspecting multiple storage backends in React Native DevTools.

The Storage Plugin provides a single inspector for sync and async storages, including MMKV, AsyncStorage and Expo SecureStore via adapters.

## Installation

```bash
npm install @rozenite/storage-plugin
```

Optional peers depending on adapters you use:

```bash
npm install react-native-mmkv @react-native-async-storage/async-storage expo-secure-store
```

## Usage

```ts
import {
  createAsyncStorageAdapter,
  createMMKVStorageAdapter,
  createExpoSecureStorageAdapter,
  useRozeniteStoragePlugin,
} from '@rozenite/storage-plugin';

const storages = [
  createMMKVStorageAdapter({
    storages: {
      user: userStorage,
      cache: cacheStorage,
    },
  }),
  createAsyncStorageAdapter({
    storage: AsyncStorage,
  }),
  createExpoSecureStorageAdapter({
    storage: SecureStore,
    keys: ['token', 'session'],
  }),
];

useRozeniteStoragePlugin({ storages });
```

### AsyncStorage v2 and v3

`createAsyncStorageAdapter` supports both:

```ts
// v2 style: single storage object
createAsyncStorageAdapter({
  storage: AsyncStorage,
});

// v3 style: named storage instances
createAsyncStorageAdapter({
  storages: {
    auth: authStorageInstance,
    cache: {
      storage: cacheStorageInstance,
      name: 'Cache Instance',
    },
  },
});
```

`createExpoAsyncStorageAdapter` is still exported as a backward-compatible alias.

## Notes

- Unsupported value types are disabled in UI create/edit flows.
- Type support is enforced in UI, runtime and MCP tools.
- Storages without subscriptions automatically use internal polling updates.
- Per-storage blacklists are supported through adapter configuration.
