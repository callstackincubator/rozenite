# @rozenite/plugin-bridge

## 2.0.0

### Minor Changes

- [#351](https://github.com/callstackincubator/rozenite/pull/351) [`476a27f`](https://github.com/callstackincubator/rozenite/commit/476a27f5532f4e35ad66feb5c9481b9396592d14) Thanks [@V3RON](https://github.com/V3RON)! - Add `createRozeniteRpc` to `@rozenite/plugin-bridge` — a request/response RPC
  layer on top of `RozeniteDevToolsClient` with acknowledgement, heartbeats,
  timeouts, retries, cancellation, and a typed error union
  (`RozeniteProtocolError` / `RozeniteHandlerError`).

## 1.13.0

## 1.12.0

## 1.11.0

## 1.10.0

## 1.9.0

## 1.8.1

## 1.8.0

### Patch Changes

- [#222](https://github.com/callstackincubator/rozenite/pull/222) [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a) Thanks [@manapard](https://github.com/manapard)! - Fix agent session startup so `createSession()` waits for mounted plugin registrations to settle before returning, reducing races when calling plugin tools immediately after session creation.

## 1.7.0

## 1.6.0

## 1.5.1

## 1.5.0

## 1.4.0

## 1.3.0
