---
'@rozenite/network-activity-plugin': minor
---

Rewrote HTTP capture around a single recorder: the `XMLHttpRequest` hook is
now the primary capture path for the built-in stack (covering Axios,
`react-native-sse` and React Native's own `fetch`), a generic fetch wrapper
covers every fetch implementation that doesn't send an XHR (Expo's
`expo/fetch`), and `react-native-nitro-fetch` HTTP traffic is translated into
the same recorder in one shot instead of being diffed. One module now owns
request ids, timing, every emitted event and the response body registry,
replacing three separate capture paths, their own emitters, and duplicate
timing/body logic.

Two intentional behavior changes:

- nitro response bodies are now captured up to 1 MiB, up from a 4 KiB cap.
- Expo SDK 54–55 no longer capture `expo/fetch` response bodies at all (they
  previously did, but only after the app itself consumed the body with
  `text()`/`arrayBuffer()`). The request row itself is still recorded. Expo
  SDK 56 and newer are unaffected.

No changes to the emitted wire format, the DevTools panel, the public
`useNetworkActivityDevTools`/`withOnBootNetworkActivityRecording` API, or the
agent tools.
