# @rozenite/plugin-bridge

## 2.2.0

### Minor Changes

- [#406](https://github.com/callstackincubator/rozenite/pull/406) [`4f5fe74`](https://github.com/callstackincubator/rozenite/commit/4f5fe747ca0c6e93d0bf05076c7e2e2ad25fd744) Thanks [@V3RON](https://github.com/V3RON)! - Route messages carrying a `pluginId` to only the panels of that plugin instead of broadcasting them to every mounted panel. Messages without a `pluginId` (e.g. shell configuration) are still broadcast to all panels, and the host-to-panel and panel-to-host wiring is unchanged.

  `@rozenite/plugin-bridge` now exports `getDevToolsMessage` and `DevToolsPluginMessage`, which `@rozenite/shell` uses to detect a message's target plugin instead of duplicating the same shape check. `getDevToolsMessage` now also requires `pluginId` to be a string, not just present.

## 2.1.0

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
