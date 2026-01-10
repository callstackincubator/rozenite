# Shared Storage

Rozenite provides a built-in mechanism for sharing a synchronized key-value store between your React Native app and the DevTools panels. This is useful for plugin settings, toggles, or any state that needs to be persisted on the developer's machine and immediately available on the device.

## Key Features

- **Synchronized Access**: Read values instantly on the device side.
- **Persistence**: Data is owned by the DevTools and persisted in the browser's local storage.
- **Automatic Sync**: Device starts with defaults and switches to saved values as soon as a connection is established.
- **Type Safety**: Full TypeScript support for your storage schema.

## Basic Usage

### 1. Define your Storage Schema

First, define the structure of your storage:

```typescript
interface MyPluginStorage {
  isRecordingEnabled: boolean;
  theme: 'light' | 'dark';
  refreshInterval: number;
}

const defaults: MyPluginStorage = {
  isRecordingEnabled: false,
  theme: 'light',
  refreshInterval: 5000,
};
```

### 2. Create the Storage Instance

Use `createRozeniteSharedStorage` to create an instance. This should typically be done in a shared file or at the entry point of your plugin.

```typescript
import { createRozeniteSharedStorage } from '@rozenite/plugin-bridge';

export const storage = createRozeniteSharedStorage<MyPluginStorage>(
  '@my-org/my-plugin',
  defaults
);
```

### 3. Connect to the Client

The storage needs to be connected to the `RozeniteDevToolsClient` on both the React Native and DevTools sides.

#### In React Native

```typescript title="react-native.ts"
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { storage } from './storage';

export function useMyPlugin() {
  const client = useRozeniteDevToolsClient({ pluginId: '@my-org/my-plugin' });

  useEffect(() => {
    if (client) {
      storage.connect(client);
    }
  }, [client]);
}
```

#### In DevTools Panel

```typescript title="src/MyPanel.tsx"
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { storage } from './storage';

export default function MyPanel() {
  const client = useRozeniteDevToolsClient({ pluginId: '@my-org/my-plugin' });

  useEffect(() => {
    if (client) {
      storage.connect(client);
    }
  }, [client]);
  
  // ...
}
```

## Using in React Components

Rozenite provides a `useRozeniteSharedStorage` hook to reactively use the storage values.

```typescript
import { useRozeniteSharedStorage } from '@rozenite/plugin-bridge';
import { storage } from './storage';

export function MyComponent() {
  const data = useRozeniteSharedStorage(storage);

  return (
    <div>
      <p>Theme: {data.theme}</p>
      <button onClick={() => storage.set('theme', 'dark')}>
        Switch to Dark
      </button>
    </div>
  );
}
```

### Ensuring Synchronization

Sometimes you don't want to render anything until the storage has been synchronized with the DevTools (to avoid flickering from defaults to saved values). You can use the `ensureSynchronized` option:

```typescript
const data = useRozeniteSharedStorage(storage, { ensureSynchronized: true });

if (!data) {
  return <p>Syncing...</p>; // data is null until synchronization is complete
}

return <p>Theme: {data.theme}</p>;
```

## API Reference

### `createRozeniteSharedStorage(pluginId, defaults)`

Creates a new shared storage instance.

- `pluginId`: A unique identifier for your plugin.
- `defaults`: Initial values to use when no persisted data is available.

### `storage.get(key)`

Returns the current synchronized value for a given key.

### `storage.set(key, value)`

Updates a value. If called from the DevTools side, it will be persisted and synced to the device.

### `storage.subscribe(callback)`

Subscribes to changes in the storage. Returns an unsubscribe function.

### `useRozeniteSharedStorage(storage, options?)`

A React hook that returns the current storage state and triggers re-renders on updates.

| Option | Type | Description |
| --- | --- | --- |
| `ensureSynchronized` | `boolean` | If `true`, the hook returns `null` until the first sync with DevTools. Defaults to `false`. |
