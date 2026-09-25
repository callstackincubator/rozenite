---
'@rozenite/network-activity-plugin': minor
---

Rewrote HTTP capture around a single recorder: the `XMLHttpRequest` hook is
now the primary capture path for the built-in stack (covering Axios,
`react-native-sse` and React Native's own `fetch`), a generic fetch wrapper
covers Expo's `expo/fetch` (and, only when it lazily resolves to that same
implementation, the global `fetch`), and `react-native-nitro-fetch` HTTP
traffic is translated into the same recorder in one shot instead of being
diffed. RN's own `fetch` polyfill, an application wrapper around it, and
nitro's `fetch` are never wrapped by the generic fetch path — the XHR hook
and nitro's `NetworkInspector` already record that traffic, and either can
send its request asynchronously, which would double-record it if wrapped.
One module now owns request ids, timing, every emitted event and the
response body registry, replacing three separate capture paths, their own
emitters, and duplicate timing/body logic.

Behavior changes, some of them to the wire format:

- nitro response and request bodies, and nitro WebSocket messages, are now
  captured up to 1 MiB, up from a 4 KiB cap. nitro also now retains at most
  100 entries (down from 500) as a trade-off for the larger cap.
- Expo SDK 54–55 no longer capture `expo/fetch` response bodies at all (they
  previously did, but only after the app itself consumed the body with
  `text()`/`arrayBuffer()`). The request row itself is still recorded. Expo
  SDK 56 and newer are unaffected.
- Requests captured from `react-native-nitro-fetch` now get the same
  `req_<timestamp>_<random>` request id every other transport uses, instead
  of nitro's own entry id.
- A fetch request's `AbortSignal` is no longer sent on `request-sent` (it
  serialized to an uninformative `{}` and was never part of the documented
  `Request` wire type).
- Request headers captured from `XMLHttpRequest` (built-in `fetch`, Axios)
  now match React Native's own header storage exactly: the header name is
  lowercased and the value is coerced with `String()`, and a header set more
  than once keeps only the last value — it is not merged into an array. This
  fixes a mismatch introduced in the pre-release version of this rewrite.
- The initiator preview attached to a fetch-captured request now starts at
  the application's own calling frame, matching the XHR path, instead of at
  an internal async-transpilation helper frame.
- A fetch call still in flight when `network-disable` arrives now completes
  and its events still reach a listener that stays subscribed (e.g. the
  agent tools' internal state), instead of being silently dropped.

No change to the public `useNetworkActivityDevTools`/
`withOnBootNetworkActivityRecording` API or the DevTools panel.
