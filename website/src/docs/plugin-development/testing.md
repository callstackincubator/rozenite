# Testing Plugins

Rozenite plugin tests should cover two different loops:

1. Automated tests for your plugin bridge logic and React components
2. Manual checks in the **Rozenite dev host** started by `rozenite dev`

Use both. Automated tests keep message flows stable. The dev host helps you iterate on panels and payload shapes quickly.

## Automated Tests With `@rozenite/plugin-bridge/testing`

`@rozenite/plugin-bridge/testing` provides a harness and a provider for testing code that uses `useRozeniteDevToolsClient`.

- The harness starts **disconnected**, so your tests can cover the real `client === null` state before DevTools connects.
- When you call `connect(pluginId)`, the production hook receives a test client instead of creating the real bridge client.
- You can inspect outbound messages with `getSent(pluginId)` and fake inbound messages with `emit(pluginId, type, payload)`.

```tsx title="plugin.test.tsx"
import { act } from 'react';
import { render } from '@testing-library/react';
import {
  createRozeniteTestHarness,
  RozeniteDevToolsTestProvider,
} from '@rozenite/plugin-bridge/testing';
import { MyPanel } from './panel';

type PluginEvents = {
  snapshot: { items: string[] };
  'get-snapshot': { type: 'get-snapshot' };
};

it('requests data after DevTools connects', async () => {
  const harness = createRozeniteTestHarness<PluginEvents>();

  render(
    <RozeniteDevToolsTestProvider harness={harness}>
      <MyPanel />
    </RozeniteDevToolsTestProvider>,
  );

  expect(harness.getSent('my-plugin')).toEqual([]);

  await act(async () => {
    harness.connect('my-plugin');
  });

  expect(harness.getSent('my-plugin')).toContainEqual({
    pluginId: 'my-plugin',
    type: 'get-snapshot',
    payload: { type: 'get-snapshot' },
  });
});
```

### Delayed Connection

The harness is intentionally explicit about connection state.

- Before `connect(pluginId)`, the hook returns `null`
- After `connect(pluginId)`, your plugin effects run with a connected client
- After `disconnect(pluginId)`, the hook returns `null` again

That makes it easy to test loading states, late initialization, and cleanup behavior.

```tsx title="react-native.test.tsx"
await act(async () => {
  harness.connect('my-plugin');
});

await act(async () => {
  harness.emit('my-plugin', 'snapshot', { items: ['first'] });
});

await act(async () => {
  harness.disconnect('my-plugin');
});
```

### When To Use The Harness

Use the harness when you want to test:

- Panel components that subscribe with `client.onMessage(...)`
- Native hooks that send snapshots or react to DevTools commands
- Bridge lifecycle behavior around `client === null`

This avoids per-test `vi.mock('@rozenite/plugin-bridge', ...)` setups and keeps tests closer to real plugin behavior.

## Manual Testing With `rozenite dev`

`rozenite dev` starts a browser host for your plugin. This is the fastest way to validate panel UI and message payloads without wiring up a playground app first.

The dev host gives you:

- **Panel preview** for every panel declared in `rozenite.config.ts`
- **Message log** for outbound messages sent by the panel
- **Dispatch message** controls for sending inbound commands with JSON payloads

The host fills `pluginId` from your plugin package `name`. That value must match the `pluginId` you pass to `useRozeniteDevToolsClient` or `getRozeniteDevToolsClient`.

Use this loop for:

- fast panel UI iteration
- checking outbound payload shapes
- manually replaying inbound commands from DevTools

Use a real React Native app when you need to exercise `react-native.ts`, device APIs, or native integrations.

## Recommended Workflow

1. Use automated tests to cover message flows, delayed connection, and component behavior.
2. Use `rozenite dev` to iterate on panel UI and payloads.
3. Use a real app only for the native side that the browser host cannot execute.
