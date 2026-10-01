# 0001 — XHR-first network capture with one recorder

**Status:** Accepted

**Related:** [0002](./0002-network-activity-on-device-regression-harness.md)
(the harness that guards this change)

## Context

`@rozenite/network-activity-plugin` records HTTP traffic on the device and
sends it to the DevTools panel and to the agent tools as the events in
`packages/network-activity-plugin/src/shared/http-events.ts`
(`request-sent`, `response-received`, `request-progress`,
`request-completed`, `request-failed`, plus `response-body` on demand).

Today those events are assembled in three unrelated capture paths under
`packages/network-activity-plugin/src/react-native/`:

| Path | Hook | Lines |
|---|---|---|
| `http/xhr-interceptor.ts` + `http/http-inspector.ts` | `XMLHttpRequest.prototype` (`open`, `setRequestHeader`, `send`) | ~425 |
| `http/fetch-interceptor.ts` + `http/fetch-utils.ts` | Expo's private `expo/src/winter/fetch/fetch` export and its global alias | ~505 |
| `nitro-fetch/nitro-network-inspector.ts` | `react-native-nitro-fetch`'s `NetworkInspector.onEntry` | ~390 |

Each path has its own emitter, its own request ids, its own timing and size
arithmetic, and its own body storage (`http/network-requests-registry.ts`
keeps live `XMLHttpRequest` instances; the nitro adapter keeps a second map
of strings). Fixes recorded in the git history for 204 responses, content
types, timeouts, binary bodies and Axios bodies each had to be applied to
one path and did not carry to the others.

The XHR interceptor is a copy of React Native's own, with six callback
types of which the plugin uses two, and it reads the private `_url`,
`_method` and `_headers` fields of RN's `XMLHttpRequest`. The Expo
interceptor carries reconciliation logic for Expo SDK 56's lazily installed
global alias and a fallback for SDK 54–55, where `Response.clone()` throws,
that decorates `text()` and `arrayBuffer()` on the returned response. The
nitro adapter diffs entry snapshots on every notification even though
nitro's `NetworkInspector` notifies HTTP entries exactly once, at the end.
It also enables that inspector without options, so nitro bodies are
silently truncated at nitro's 4 KiB default.

The question raised was whether wrapping `fetch` could replace the XHR hook
and collapse all of this into one wrapper. Two facts decide it:

- **React Native's own `fetch` is XHR.** RN 0.86's
  `Libraries/Network/fetch.js` installs the `whatwg-fetch` polyfill, whose
  `fetch()` constructs an `XMLHttpRequest` and calls `open()` and `send()`
  synchronously inside the promise executor. An XHR hook sees every call
  to that `fetch` exactly once, and also sees Axios (whose default RN
  adapter is XHR), `react-native-sse` (built on XHR) and any other direct
  XHR user. A fetch-only hook sees none of those.
- **Expo's `expo/fetch` and `react-native-nitro-fetch` never touch XHR.**
  They are native implementations. The only JavaScript-level way to see
  them is to wrap their `fetch` function, or, for nitro, to consume its
  first-party `NetworkInspector`. Expo SDK 56 and newer also make
  `expo/fetch` the global `fetch` as a side effect of importing `expo`
  (`expo/src/winter/runtime.native.ts`), unless the app sets
  `EXPO_PUBLIC_USE_RN_FETCH`. In such an app a plain `fetch()` call is a
  native fetch and only a wrapper around the global sees it, while Axios
  and SSE in the same app still go through XHR. Both hooks are therefore
  needed in one app, not one or the other depending on the app.

A fetch-only wrapper is therefore not a replacement for the XHR hook. The
design adopted here is XHR first, with a fetch wrapper only for fetch
implementations that send no XHR, and a synchronous flag set around the
original `fetch` call to deduplicate the two. It is the only arrangement
that preserves the plugin's existing coverage.

Behaviour that exists today and must survive: Axios and other XHR clients,
SSE via `react-native-sse` (its inspector resolves the request id from the
underlying XHR), download progress and time to first byte, request
timeouts and aborts, response overrides for the built-in stack, initiator
stack capture, text and binary bodies with the 5 MiB binary cap, recording
before DevTools connects (`withOnBootNetworkActivityRecording`), and nitro
WebSocket traffic.

## Decision

1. **The `XMLHttpRequest.prototype` hook is the primary capture for the
   built-in stack.** It patches `open`, `setRequestHeader` and `send`,
   keeps per-instance state in a `WeakMap`, and reads no underscore-prefixed
   RN field except where a public API does not exist. It exports a lookup
   from an XHR instance to its request id; the SSE inspector uses that
   lookup instead of a field written onto the XHR. Progress and
   `readystatechange` listeners stay, so RN's incremental mode is entered
   for observed requests exactly as it is today.

2. **One generic fetch wrapper covers every fetch implementation that does
   not send an XHR.** `wrapFetch(original, source)` is installed on Expo's
   writable private export `expo/src/winter/fetch/fetch` when it resolves,
   and on `globalThis.fetch` only when the global is, or lazily resolves
   to, Expo's implementation. The global is read before the private export
   is patched, so an Expo getter that later resolves to the Expo wrapper is
   recognised and not wrapped a second time, and disable restores Expo's
   original. The wrapper sets a module-level "active fetch" marker before
   calling the original and clears it afterwards; the patched `send` marks
   the active call as having sent an XHR; a wrapper whose call sent an XHR
   records nothing. The global is never wrapped when it is React Native's
   own polyfill or an application wrapper around it: such wrappers commonly
   send their XHR asynchronously (after awaiting a token, for example),
   which defeats the synchronous marker and records every request twice.
   Outside Expo the XHR hook already sees that traffic; in an Expo app a
   wrapper installed around Expo's global before recording starts is not
   observed, as before this decision. The global is also not wrapped
   when it is `react-native-nitro-fetch`'s `fetch`, because decision 3
   records that traffic. Every fetch-wrapper event is labelled `expo`.

3. **nitro traffic keeps coming from `react-native-nitro-fetch`'s
   `NetworkInspector`.** Its `Response.clone()` drops streaming bodies and
   its documentation advises against wrapping its `fetch`. HTTP entries are
   translated in one shot on notification (sent, received, completed, or
   failed) with no snapshot diffing; WebSocket entries keep the diffing they
   need. The inspector is enabled with a 1 MiB `maxBodyCapture`.

4. **One recorder owns the wire format.** A single module creates request
   ids, computes timestamps, duration and time to first byte, builds every
   `HttpEventMap` payload, owns the body registry and the event emitter.
   Adapters call `begin(meta)` and then `headers`, `progress`, `end` or
   `fail` on the returned handle. The body registry stores one thunk per
   request id under the existing five-minute TTL: the XHR adapter registers
   a lazy read of the XHR, the fetch and nitro adapters register the body
   they captured. Adapters never construct event payloads.

5. **Response bodies from fetch implementations come from
   `Response.clone()`.** When `clone()` is unavailable or throws (Expo SDK
   54–55), the request completes at once and the wrapper instead observes
   the application's own consumption of that one response instance: its
   `text()` and `arrayBuffer()` are wrapped, the first result is kept, and
   the body registry's thunk returns it, or `null` when the application
   never read the body. The thunk never waits for the application, so a
   body request cannot hang. `blob()` and direct stream readers are not
   observed on those SDKs. This path is covered by unit tests only, because
   the playground runs an Expo SDK whose `clone()` works.

6. **Response overrides stay built-in only**, applied at the XHR level as
   documented in the plugin README.

7. **The public surface does not change.** `useNetworkActivityDevTools`,
   `withOnBootNetworkActivityRecording`, `NetworkActivityDevToolsConfig`,
   the event types in `src/shared`, the agent tools and the DevTools UI are
   untouched. Internally, the three per-protocol React hooks
   (`useHttpInspector`, `useWebSocketInspector`, `useSSEInspector`) fold
   into `useNetworkActivityDevTools`, which already handles the same
   `network-enable` and `network-disable` messages.

## Consequences

- The HTTP capture path drops from roughly 1,900 lines to roughly 850, and
  the React hooks from roughly 350 to roughly 200. Further reduction means
  removing a feature from the list above and needs its own decision.
- A fix to timing, sizing or body handling is made once in the recorder and
  applies to built-in, Expo and nitro traffic alike.
- Double counting is prevented by scope, not only by the synchronous
  marker: the fetch wrapper is installed only where the wrapped function is
  known to be a native implementation. A future React Native release that
  ships a native global `fetch` needs a new decision to wrap it.
- Expo SDK 54 and 55 keep body capture for `expo/fetch`, but only for
  bodies the application itself reads through `text()`, `json()` or
  `arrayBuffer()`, as before. Expo SDK 56 and newer capture every body.
- nitro bodies grow from 4 KiB to 1 MiB; the DevTools panel already handles
  bodies of that size from the built-in path.
- The SSE inspector's dependency on the XHR hook remains, now through an
  exported lookup rather than a private field.
