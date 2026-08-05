# RPC

The `RozeniteDevToolsClient` you get from `getRozeniteDevToolsClient` (see the
[Plugin Development Guide](./plugin-development.md)) is fire-and-forget:
`send(type, payload)` and `onMessage(type, listener)`. That's the right tool
for events, but it isn't an answer to "call this and give me a result."

Every plugin that needs a result back from the other side ends up
reinventing the same thing by hand: a correlation id, a matching response
event type, a `Promise` stored in a map, and an ad-hoc timeout. And none of
that hand-rolled scaffolding protects you from the case that actually causes
support tickets — the panel isn't mounted yet, or the device peer has died,
and your caller just hangs forever with no `Promise` ever settling.

`@rozenite/plugin-bridge` ships `createRozeniteRpc` so you don't have to
build this yourself. It gives you an awaitable call with acknowledgement,
heartbeats, timeouts, and cancellation on top of your existing client.

```typescript
import { getRozeniteDevToolsClient, createRozeniteRpc } from '@rozenite/plugin-bridge';

type MyMethods = {
  readFile: (params: { path: string }) => Promise<string>;
  listDevices: () => Promise<Device[]>;
};

const client = await getRozeniteDevToolsClient<MyEventMap>('your-plugin-id');
const rpc = createRozeniteRpc<MyMethods>(client);
```

The abstraction is **symmetric**: both the device and the panel can register
handlers with `handle()` and call methods on the same `rpc` instance.

## Reserved message type

RPC rides on top of your existing `RozeniteDevToolsClient` — there's no
separate channel to set up. It reserves a single message type,
`'rozenite:rpc'`, for its own use. Don't use `'rozenite:rpc'` as an event
type in your own plugin's event map, or it will collide with the RPC layer.

## Declaring methods

Methods are declared function-shaped, so params and result are both
inferred from a single type:

```typescript
type MyMethods = {
  readFile: (params: { path: string }) => Promise<string>;
  listDevices: () => Promise<Device[]>;
};
```

## Registering a handler

```typescript
rpc.handle('readFile', async ({ path }) => {
  return fs.readFileSync(path, 'utf8');
});
```

Registering a second handler for the same method throws immediately, at
registration time — a method has exactly one handler on a given peer.

## Calling a method

Calling is a two-step handle: `method()` names the method and takes the
call's options, and `invoke()` takes the params.

```typescript
await rpc.method('getUser').invoke({ id: '42' });
await rpc.method('listDevices').invoke();
await rpc.method('readFile', { timeoutMs: 60_000 }).invoke({ path });
```

This is the only call form. A handle holds nothing but the method name and
its options — no subscription, no state — so creating one per call is free,
and reusing one across multiple calls is equally fine:

```typescript
const readFile = rpc.method('readFile', { timeoutMs: 60_000 });
await readFile.invoke({ path: 'a' });
await readFile.invoke({ path: 'b' });
```

Note that the handle is a plain object with an `invoke` method — it is not
itself callable. A remote call that reads like an ordinary function call
hides the fact that it can time out, stall, or be cancelled; `.invoke()`
keeps that round-trip visible at the call site.

## Why a single timeout isn't enough

A single constant timeout is the wrong tool here: a legitimately slow
handler would trip it, while a handler that's actually gone is
indistinguishable from one that's just slow. RPC splits **liveness** from
**duration** — the receiver acknowledges a request immediately, then sends
heartbeats while it executes. "Slow but alive" and "gone" become different,
observable states.

### The three timers and their defaults

Every `invoke()` call is guarded by three independent, caller-side timers:

| Option | Default | Window | Fires when |
| --- | --- | --- | --- |
| `ackTimeoutMs` | `5_000` | `invoke()` → acknowledged | Nobody is listening, or the peer isn't mounted yet. This is the **only** retryable failure — `ACK_TIMEOUT`. |
| `staleTimeoutMs` | `6_000` (3× `heartbeatMs`) | since the last sign of life | The peer died, or its event loop is blocked. `STALLED`. |
| `timeoutMs` | `30_000` | `invoke()` → settle | Absolute cap. Catches a handler that never resolves — it would otherwise heartbeat forever. `TIMEOUT`. Pass `Infinity` to opt out. |

`heartbeatMs` (default `2_000`) is set by the caller via `method()`'s
options; it controls how often the receiver sends a heartbeat while handling
that call.

### Retries

`retries` (default `1`) applies **only** to `ACK_TIMEOUT` — the one failure
where the handler provably never ran. `STALLED` and `TIMEOUT` never retry,
because by the time either fires the handler may already have committed side
effects, and a handler error never retries by construction.

Because the retry budget is consumed before `timeoutMs` is re-armed for the
retried attempt, `retries: 1` can cost up to `ackTimeoutMs + timeoutMs` in
the worst case: the first attempt burns a full `ackTimeoutMs` before giving
up, and the retry then gets its own full `timeoutMs` window.

## Cancellation

Pass an `AbortSignal` to cancel a call in flight. Every caller-side give-up —
`STALLED`, `TIMEOUT`, or your own `AbortSignal` — aborts the handler's
`ctx.signal` on the other side, so long-running work can stop instead of
running to no purpose:

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

```typescript
const controller = new AbortController();
const promise = rpc
  .method('longRunning', { signal: controller.signal })
  .invoke();

controller.abort(); // -> rejects with a CANCELLED error, aborts ctx.signal
```

The caller rejects immediately on cancellation and drops any late result
that arrives afterwards — a handler that settles after cancellation is
silently discarded, with no error and no dangling frame.

## Known limitation: heartbeats only prove the event loop is alive

A heartbeat proves the peer's **event loop** is alive, not that the handler
is making progress. Synchronous work blocks the heartbeat timer too, so a
10-second synchronous loop on either side looks exactly like a dead peer.
This design cannot detect a synchronous long-running block — make sure
`staleTimeoutMs` comfortably exceeds the longest synchronous stretch you
expect on either side, and raise it per-call for handlers you know will
block.

## Errors

Errors come in two shapes, discriminated by `kind`:

```typescript
export type RozeniteRpcError = RozeniteProtocolError | RozeniteHandlerError;
```

- **`RozeniteProtocolError`** (`kind: 'protocol'`) — the call itself failed,
  not your handler. `error.code` is one of:
  - `ACK_TIMEOUT` — nobody acknowledged the request in time; the handler
    never ran.
  - `STALLED` — the peer stopped sending any sign of life.
  - `TIMEOUT` — the call didn't settle within the absolute cap.
  - `CANCELLED` — the caller's `AbortSignal` fired.
  - `METHOD_NOT_FOUND` — no handler is registered for that method on the
    peer.
  - `SERIALIZATION_ERROR` — the result (or error `data`) couldn't survive
    the transport.
  - `CLIENT_CLOSED` — `close()` was called while the call was in flight.
- **`RozeniteHandlerError`** (`kind: 'handler'`) — the remote handler ran and
  threw. `error.message` is `` `${method} failed: ${remote.message}` `` and
  `error.stack` is **your own** call stack, so you always see who invoked
  the call. The remote's own `name`, `message`, `stack` (development builds
  only), and any handler-supplied `data` live under `error.remote`.

Narrow on `kind`, not `instanceof` — a plugin's device code and panel code
are separate bundles, so `instanceof` only happens to work when the error
was constructed by the bundle doing the check. Use the exported type guards
instead:

```typescript
import { isProtocolError, isHandlerError } from '@rozenite/plugin-bridge';

try {
  await rpc.method('readFile').invoke({ path });
} catch (error) {
  if (isProtocolError(error)) {
    // error.code: ACK_TIMEOUT | STALLED | TIMEOUT | CANCELLED |
    //             METHOD_NOT_FOUND | SERIALIZATION_ERROR | CLIENT_CLOSED
  } else if (isHandlerError(error)) {
    // error.remote.name / error.remote.message / error.remote.data
  }
}
```

## API reference

```typescript
const rpc = createRozeniteRpc<MyMethods>(client);

rpc.method(method, options?): RpcMethodHandle;
rpc.method(method, options?).invoke(params?): Promise<Result>;
rpc.handle(method, handler): Subscription;
rpc.close(): void;
```

- `InvokeOptions.signal?: AbortSignal`
- `InvokeOptions.ackTimeoutMs?: number` — default `5_000`
- `InvokeOptions.heartbeatMs?: number` — default `2_000`
- `InvokeOptions.staleTimeoutMs?: number` — default `6_000`
- `InvokeOptions.timeoutMs?: number` — default `30_000`, pass `Infinity` to opt out
- `InvokeOptions.retries?: number` — default `1`, `ACK_TIMEOUT` only

Calling `close()` removes the underlying message subscription and rejects
every in-flight call with `CLIENT_CLOSED`.
