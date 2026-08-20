---
'@rozenite/testing': minor
'@rozenite/plugin-bridge': minor
---

Add new `@rozenite/testing` package — in-process test doubles for Rozenite plugin communication. `connectFakePair()` gives you both ends of an in-memory `Channel`, so a plugin's panel and `react-native.ts` code can be run against each other in Node, without Metro or a simulator. `waitForMessage`, `waitForChannelMessage`, and the RPC-aware `waitForRpcFrame` wait for a matching message with a required timeout, rejecting with a clear error on expiry instead of hanging.

This is built on a new `channel` option on `@rozenite/plugin-bridge`'s `getRozeniteDevToolsClient` and `useRozeniteDevToolsClient`, which lets a caller supply its own `Channel` instead of resolving one from the environment. Production behavior is unchanged when it's left unset.
