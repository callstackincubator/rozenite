---
'@rozenite/plugin-bridge': minor
---

Add `createRozeniteRpc` to `@rozenite/plugin-bridge` — a request/response RPC
layer on top of `RozeniteDevToolsClient` with acknowledgement, heartbeats,
timeouts, retries, cancellation, and a typed error union
(`RozeniteProtocolError` / `RozeniteHandlerError`).
