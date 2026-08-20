# Testing

Running your plugin end to end — Metro, a simulator, the app, and React Native
DevTools — is the right way to verify how a panel looks and feels. It is a slow
way to answer the question you ask far more often: do the panel and the
`react-native.ts` side still agree on the messages they exchange?

`@rozenite/testing` answers that one in milliseconds. It gives you both ends of
an in-memory channel, so your real panel code and your real React Native code
run against each other in Node — no Metro, no simulator, no DevTools.

## Installation

Install it as a dev dependency alongside `@rozenite/plugin-bridge`:

```shell title="Terminal"
npm install --save-dev @rozenite/testing @rozenite/plugin-bridge
```

The package works with any test runner — Vitest, Jest, or `node --test`. It
brings no runner globals of its own, so you keep using your runner's
assertions.

To render panel components you also need React and a renderer such as
[React Testing Library](https://testing-library.com/docs/react-testing-library/intro),
plus a DOM environment (`jsdom` or `happy-dom`) configured in your runner. The
message-level and RPC tests below need neither.

## Test the messages between both sides

`connectFakePair()` returns two ends of one channel: `device` and `panel`.
Whatever one end sends arrives at the other. Hand each end to a client with the
`channel` option, and both sides run their real communication code.

```typescript title="src/__tests__/cache-inspector.test.ts"
import { getRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { connectFakePair, waitForMessage } from '@rozenite/testing';
import { describe, expect, it } from 'vitest';
import { registerCacheHandlers } from '../react-native';

type CacheInspectorEvents = {
  'cache-entries-request': Record<string, never>;
  'cache-entries': { entries: { key: string; sizeBytes: number }[] };
};

describe('cache inspector protocol', () => {
  it('answers a cache-entries-request with the current entries', async () => {
    const { device, panel } = connectFakePair();

    const deviceClient = await getRozeniteDevToolsClient<CacheInspectorEvents>(
      '@acme/cache-inspector',
      { channel: device }
    );
    const panelClient = await getRozeniteDevToolsClient<CacheInspectorEvents>(
      '@acme/cache-inspector',
      { channel: panel }
    );

    // Your real device-side handlers, wired the way react-native.ts wires them.
    registerCacheHandlers(deviceClient, {
      entries: [{ key: 'user:42', sizeBytes: 1024 }],
    });

    panelClient.send('cache-entries-request', {});

    const response = await waitForMessage(panelClient, 'cache-entries', {
      timeoutMs: 1000,
    });

    expect(response.entries).toEqual([{ key: 'user:42', sizeBytes: 1024 }]);

    deviceClient.close();
    panelClient.close();
  });
});
```

Messages are always delivered asynchronously, exactly as they are on a device.
A `send()` never reaches the other side's listener before the current tick
finishes, so assert on what arrived with `await`, never straight after
`send()`.

Pass the same `pluginId` to both clients. Clients only receive messages
addressed to their own plugin, so a mismatched id looks exactly like a message
that never arrived.

## Test an RPC method

[RPC methods](./rpc.md) work over the same pair — register a handler on one
side and call it from the other:

```typescript
import { createRozeniteRpc } from '@rozenite/plugin-bridge';

type CacheMethods = {
  clearEntry: (params: { key: string }) => Promise<{ cleared: boolean }>;
};

const deviceRpc = createRozeniteRpc<CacheMethods>(deviceClient);
const panelRpc = createRozeniteRpc<CacheMethods>(panelClient);

deviceRpc.handle('clearEntry', async ({ key }) => ({ cleared: cache.delete(key) }));

const result = await panelRpc.method('clearEntry').invoke({ key: 'user:42' });

expect(result).toEqual({ cleared: true });
```

Errors thrown by a handler travel back to the caller, so `expect(...).rejects`
works on a failing call the same way it does in production.

## Test your panel component

Panel components call `useRozeniteDevToolsClient({ pluginId })` themselves and
take no channel prop — so wrap the component in `RozeniteChannelProvider` and
give it one end of the pair. Every `useRozeniteDevToolsClient()` inside the
provider uses that channel instead of connecting to DevTools, and the component
under test stays exactly as it ships.

```tsx title="src/__tests__/cache-inspector-panel.test.tsx"
import { getRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { connectFakePair, RozeniteChannelProvider } from '@rozenite/testing';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import CacheInspectorPanel from '../cache-inspector-panel';

it('lists the entries reported by the device', async () => {
  const { device, panel } = connectFakePair();

  const deviceClient = await getRozeniteDevToolsClient<CacheInspectorEvents>(
    '@acme/cache-inspector',
    { channel: device }
  );

  deviceClient.onMessage('cache-entries-request', () => {
    deviceClient.send('cache-entries', {
      entries: [{ key: 'user:42', sizeBytes: 1024 }],
    });
  });

  render(
    <RozeniteChannelProvider channel={panel} role="panel">
      <CacheInspectorPanel />
    </RozeniteChannelProvider>
  );

  expect(await screen.findByText('user:42')).toBeTruthy();

  deviceClient.close();
});
```

`role` tells the provider which side of the protocol the subtree stands in for.
Only the React Native side announces itself with a `plugin-mounted` message, so
`role="panel"` keeps that message off the wire and `role="device"` puts it
there. Set it whenever a test asserts on the exact messages exchanged.

## Test your React Native side

If your React Native integration is a hook, render it the same way with the
other end of the pair:

```tsx
import { connectFakePair, RozeniteChannelProvider, waitForMessage } from '@rozenite/testing';

const { device, panel } = connectFakePair();

const panelClient = await getRozeniteDevToolsClient<CacheInspectorEvents>(
  '@acme/cache-inspector',
  { channel: panel }
);

const CacheInspectorHost = () => {
  useCacheInspectorPlugin();
  return null;
};

render(
  <RozeniteChannelProvider channel={device} role="device">
    <CacheInspectorHost />
  </RozeniteChannelProvider>
);

panelClient.send('cache-entries-request', {});

const response = await waitForMessage(panelClient, 'cache-entries', {
  timeoutMs: 1000,
});
```

If your integration is a plain function that takes a client, skip the provider
and pass it a client built with the `channel` option, as in the first example.

## Wait for a message

Three helpers wait for something to arrive. Each takes a required `timeoutMs`
and rejects with a `WaitForTimeoutError` when nothing matching shows up, so a
broken protocol fails your test instead of hanging your suite.

```typescript
import {
  waitForMessage,
  waitForChannelMessage,
  waitForRpcFrame,
} from '@rozenite/testing';

// The next message of a given type, optionally filtered.
const entries = await waitForMessage(
  panelClient,
  'cache-entries',
  { timeoutMs: 1000 },
  (payload) => payload.entries.length > 0
);

// The next raw message on a channel, before any client sorts it by plugin.
const raw = await waitForChannelMessage(panel, (message) => message != null, {
  timeoutMs: 1000,
});

// The next RPC frame, for asserting that a call was made at all.
const frame = await waitForRpcFrame<{ kind: string; method: string }>(
  panelClient,
  (frame) => frame.kind === 'request' && frame.method === 'clearEntry',
  { timeoutMs: 1000 }
);
```

Start waiting before you trigger the exchange when the reply can be immediate:

```typescript
const entries = waitForMessage(panelClient, 'cache-entries', { timeoutMs: 1000 });
panelClient.send('cache-entries-request', {});
await entries;
```

## Simulate a slow or missing peer

A pair can drop or delay messages in either direction, which is how you cover
the cases that are painful to reproduce on a device — a panel that was never
opened, or a device that answers slowly.

```typescript
const { device, panel, dropDeviceToPanel, delayPanelToDevice } = connectFakePair();

// Nothing the device sends reaches the panel.
dropDeviceToPanel(true);

// The device hears the panel half a second late.
delayPanelToDevice(500);
```

Both take effect immediately and stay in force until you change them, so you
can drop messages part-way through a test and turn delivery back on with
`dropDeviceToPanel(false)`.

Delays use timers. If your test uses fake timers, advance them to let a delayed
message through.

## When a test times out

A `WaitForTimeoutError` means nothing matching arrived in time. The usual
causes, in the order worth checking:

- **The two clients use different plugin ids.** Messages are addressed by
  plugin id, and one that doesn't match is silently ignored.
- **The message type or payload doesn't match your predicate.** Drop the
  predicate first to confirm the message arrives at all.
- **The other side was never wired up.** Register handlers on the device client
  before the panel sends anything.
- **A client was closed too early.** Closing a client also stops delivery for
  any other client sharing that same end of the pair. Give each side its own
  pair if they need independent lifetimes.
- **A drop or delay is still in force** from an earlier step in the test.

Raise `timeoutMs` last. It is rarely the answer: everything here runs
in-process, so a message that hasn't arrived in a second is not on its way.

## What this doesn't cover

These tests prove the two sides agree on the messages they exchange. They say
nothing about how your panel looks, whether DevTools loads your plugin, or how
your code behaves against a real device — for that, run the plugin in the
[development workflow](./plugin-development.md) and check it by hand before you
release.
