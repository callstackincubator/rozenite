![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### In-process test doubles for Rozenite plugin communication.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

Testing a plugin change today usually means running Metro, a simulator, the playground app, and React Native DevTools together — right for pre-release verification, but far too expensive for the most frequent check: that a panel and its `react-native.ts` entry still agree on the protocol (messages and RPCs).

`@rozenite/testing` gives you an in-memory `Channel` pair and a couple of `waitFor` helpers built on `@rozenite/plugin-bridge`'s channel injection seam, so you can run both halves of a plugin — the real, unmodified panel code and the real, unmodified device code — against each other in Node, in milliseconds. No Metro, no simulator, no DevTools.

## Features

- **In-process fake channel pair** — `connectFakePair()` gives you the two ends of a real `Channel`; hand one to the device side and one to the panel side via `getRozeniteDevToolsClient`/`useRozeniteDevToolsClient`'s `channel` option, and both run their actual protocol code.
- **Transport simulation** — drop or delay messages in either direction, to test a side that never mounts or a slow transport.
- **`waitFor` helpers with a deadline** — `waitForMessage`, `waitForChannelMessage`, and the RPC-aware `waitForRpcFrame` all take a required `timeoutMs` and reject with a clear `WaitForTimeoutError` on expiry, instead of hanging your test suite forever.
- **Runner-agnostic** — no dependency on Vitest, Jest, or any runner globals. Everything here returns plain values and promises; keep using your own runner's assertions.

## Installation

Install the testing package alongside `@rozenite/plugin-bridge`, which it builds on:

```bash
npm install --save-dev @rozenite/testing @rozenite/plugin-bridge
```

## Quick Start

```typescript
import { getRozeniteDevToolsClient, createRozeniteRpc } from '@rozenite/plugin-bridge';
import { connectFakePair, waitForMessage } from '@rozenite/testing';

// Two ends of one in-memory Channel.
const { device, panel } = connectFakePair();

// Give one end to each side's real, unmodified client — this is the
// injection seam `@rozenite/plugin-bridge` exposes for exactly this.
const deviceClient = await getRozeniteDevToolsClient('my-plugin', { channel: device });
const panelClient = await getRozeniteDevToolsClient('my-plugin', { channel: panel });

// Wire up the device side's real message handler...
deviceClient.onMessage('get-items', () => {
  deviceClient.send('items', { items: ['a', 'b'] });
});

// ...and drive it from the panel side.
panelClient.send('get-items', {});
const response = await waitForMessage(panelClient, 'items', { timeoutMs: 1000 });
// response is { items: ['a', 'b'] }
```

The same pattern works for RPC methods built with `createRozeniteRpc`:

```typescript
import { createRozeniteRpc } from '@rozenite/plugin-bridge';

const deviceRpc = createRozeniteRpc(deviceClient);
const panelRpc = createRozeniteRpc(panelClient);

deviceRpc.handle('getSnapshot', async () => ({ items: [] }));

const snapshot = await panelRpc.method('getSnapshot').invoke();
```

## Transport simulation

```typescript
const { device, panel, dropDeviceToPanel, delayPanelToDevice } = connectFakePair();

// Simulate the panel never mounting: every message the device sends is dropped.
dropDeviceToPanel(true);

// Simulate a slow transport in the other direction.
delayPanelToDevice(500);
```

## `waitFor` helpers

```typescript
import { waitForMessage, waitForChannelMessage, waitForRpcFrame } from '@rozenite/testing';

// Client-level: waits for the next message of `type`, optionally filtered.
await waitForMessage(
  client,
  'storage:list-response',
  { timeoutMs: 1000 },
  (payload) => payload.requestId === myRequestId,
);

// Channel-level: below the pluginId/type demultiplexing a client does.
await waitForChannelMessage(channel, (message) => isMyEnvelope(message), {
  timeoutMs: 1000,
});

// RPC-aware: waits for a frame on the reserved `rozenite:rpc` message type.
await waitForRpcFrame(client, (frame) => frame.kind === 'request', { timeoutMs: 1000 });
```

Every one of these rejects with a `WaitForTimeoutError` — not a hang — when nothing matching arrives before `timeoutMs`.

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/testing
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
