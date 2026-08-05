# RPC

`@rozenite/plugin-bridge` also exposes a request/response layer on top of the
fire-and-forget `RozeniteDevToolsClient`. Instead of hand-rolling a
correlation id, a matching response event, and an ad-hoc timeout every time a
plugin needs a result back, use `createRozeniteRpc`:

```typescript
import { getRozeniteDevToolsClient, createRozeniteRpc } from '@rozenite/plugin-bridge';

type MyMethods = {
  readFile: (params: { path: string }) => Promise<string>;
  listDevices: () => Promise<Device[]>;
};

const client = await getRozeniteDevToolsClient<MyEventMap>('your-plugin-id');
const rpc = createRozeniteRpc<MyMethods>(client);

// Caller side
const contents = await rpc.invoke('readFile', { path: '/tmp/log.txt' });

// Receiver side
rpc.handle('readFile', async ({ path }) => {
  return fs.readFileSync(path, 'utf8');
});
```

The abstraction is **symmetric**: both the device and the panel can register
handlers with `handle()` and call methods with `invoke()` on the same `rpc`
instance.

## Reserved message type

RPC rides on top of the existing `RozeniteDevToolsClient` — there's no
separate channel or transport. It reserves a single message type,
`'rozenite:rpc'`, and carries every RPC frame inside its payload. Your
plugin's own event map must not use `'rozenite:rpc'` as an event name, or it
will collide with the RPC layer.

## Why a single timeout isn't enough

A single constant timeout is the wrong tool for RPC: a legitimately slow
handler trips it, while a handler that's actually gone is indistinguishable
from one that's just slow. RPC splits **liveness** from **duration**: the
receiver acknowledges a request immediately, then heartbeats while it
executes. "Slow but alive" and "gone" become different, observable states.

### The three timers

Every `invoke()` call is guarded by three independent caller-side timers:

| Timer | Window | Fires when |
| --- | --- | --- |
| `ackTimeoutMs` (default `5_000`) | `request` → `ack` | Nobody is listening, or the peer isn't mounted yet. The handler provably never ran, so this is the **only** retryable failure — `ACK_TIMEOUT`. |
| `staleTimeoutMs` (default `6_000`, 3× `heartbeatMs`) | since the last `ack` or `heartbeat` | The peer died, or its event loop is blocked. `STALLED`. |
| `timeoutMs` (default `30_000`) | `request` → settle | Absolute cap. Catches an async handler that never resolves (it would otherwise heartbeat forever). `TIMEOUT`. Pass `Infinity` to opt out. |

`heartbeatMs` (default `2_000`) is caller-dictated and sent along with the
request; the receiver's heartbeat cadence follows whatever the caller asked
for.

### Retries

`retries` (default `1`) applies **only** to `ACK_TIMEOUT`. `STALLED` and
`TIMEOUT` never retry — the handler may have already committed side effects
by the time either of those fires, and a handler error never retries by
construction. Each retry uses a fresh call id; a late `ack` for an abandoned
attempt is simply ignored.

The retry budget is consumed *before* `timeoutMs` is re-armed for the next
attempt, so `retries: 1` can cost up to `ackTimeoutMs + timeoutMs` in the
worst case: the first attempt burns a full `ackTimeoutMs` before giving up,
and the retried attempt then gets its own full `timeoutMs` window.

## Cancellation

Every caller-side give-up — `STALLED`, `TIMEOUT`, or the caller's own
`AbortSignal` — sends a `cancel` frame so the handler's `ctx.signal` aborts
instead of leaking:

```typescript
rpc.handle('longRunning', async (params, ctx) => {
  for await (const chunk of source) {
    if (ctx.signal.aborted) {
      throw new Error('aborted');
    }
    // ...
  }
});
```

`cancel` is fire-and-forget: the caller rejects immediately and drops any
late `result`/`error` frame for that call id. A handler that settles after
cancellation is silently discarded — no frame is sent back, and nothing
throws.

```typescript
const controller = new AbortController();
const promise = rpc.invoke('longRunning', undefined, {
  signal: controller.signal,
});

controller.abort(); // -> rejects with a CANCELLED error, aborts ctx.signal
```

## Progress

A handler can piggyback a progress value on its next outgoing heartbeat:

```typescript
rpc.handle('bulkImport', async (params, ctx) => {
  for (let i = 0; i < total; i++) {
    await importOne(items[i]);
    ctx.progress({ done: i + 1, total });
  }
});
```

```typescript
await rpc.invoke('bulkImport', undefined, {
  onProgress: (value) => console.log(value),
});
```

## Known limitation: heartbeats only prove the event loop is alive

The heartbeat proves the peer's **event loop** is alive — not that the
handler is making progress. Synchronous work blocks the heartbeat timer too,
so a 10-second synchronous loop on either side is indistinguishable from a
dead peer. **This design cannot detect a synchronous long-running block.**
Make sure `staleTimeoutMs` exceeds the longest synchronous block you expect
on either side; if you have known-blocking work, raise `staleTimeoutMs` for
that call.

## Errors

Errors come in two shapes, discriminated by `kind`:

```typescript
export type RozeniteRpcError = RozeniteProtocolError | RozeniteHandlerError;
```

- **`RozeniteProtocolError`** (`kind: 'protocol'`) — a transport/protocol
  failure: `ACK_TIMEOUT`, `STALLED`, `TIMEOUT`, `CANCELLED`,
  `METHOD_NOT_FOUND`, `SERIALIZATION_ERROR`, or `CLIENT_CLOSED`. It carries
  no payload and no remote stack, because the failure isn't in your code.
  Only `METHOD_NOT_FOUND` and `SERIALIZATION_ERROR` ever travel over the
  wire as protocol frames — the rest (the three timeouts, `CANCELLED`, and
  `CLIENT_CLOSED`) are always constructed on the caller's side.
- **`RozeniteHandlerError`** (`kind: 'handler'`) — the remote handler ran and
  threw. `error.message` is `` `${method} failed: ${remote.message}` `` and
  `error.stack` is **your own** call stack, so you always see who invoked
  the call. The remote's own `name`, `message`, `stack` (development builds
  only), and any handler-supplied `data` live under `error.remote`.

Narrow on `kind`, not `instanceof` — a plugin's device code and panel code
are separate bundles, so `instanceof` only happens to work when the error was
constructed by the bundle doing the check. Use the exported type guards
instead:

```typescript
import { isProtocolError, isHandlerError } from '@rozenite/plugin-bridge';

try {
  await rpc.invoke('readFile', { path });
} catch (error) {
  if (isProtocolError(error)) {
    // error.code: ACK_TIMEOUT | STALLED | TIMEOUT | CANCELLED |
    //             METHOD_NOT_FOUND | SERIALIZATION_ERROR | CLIENT_CLOSED
  } else if (isHandlerError(error)) {
    // error.remote.name / error.remote.message / error.remote.data
  }
}
```

A result (or an error's `data`) that isn't structured-cloneable is turned
into a `SERIALIZATION_ERROR` protocol error rather than letting the
underlying transport throw and hang the call.

## API reference

```typescript
const rpc = createRozeniteRpc<MyMethods>(client);

rpc.invoke(method, params?, options?): Promise<Result>;
rpc.handle(method, handler): Subscription;
rpc.close(): void;
```

- `InvokeOptions.signal?: AbortSignal`
- `InvokeOptions.ackTimeoutMs?: number` — default `5_000`
- `InvokeOptions.heartbeatMs?: number` — default `2_000`
- `InvokeOptions.staleTimeoutMs?: number` — default `6_000`
- `InvokeOptions.timeoutMs?: number` — default `30_000`, pass `Infinity` to opt out
- `InvokeOptions.retries?: number` — default `1`, `ACK_TIMEOUT` only
- `InvokeOptions.onProgress?: (value: unknown) => void`

Registering a second handler for the same method throws immediately, at
registration time. Calling `close()` removes the underlying message
subscription and rejects every in-flight call with `CLIENT_CLOSED`.

Out of scope for this API: streaming/`AsyncIterable` results (single-value
results only — use `onProgress` for incremental updates) and re-entrant calls
from inside a handler back to its own caller as part of the same request.
