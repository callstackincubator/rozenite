# @rozenite/testing

## 2.4.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@2.4.0

## 2.3.0

### Minor Changes

- [#434](https://github.com/callstackincubator/rozenite/pull/434) [`158f4e5`](https://github.com/callstackincubator/rozenite/commit/158f4e5406d6428e24164bdde82d459030fa7309) Thanks [@V3RON](https://github.com/V3RON)! - Add new `@rozenite/testing` package — in-process test doubles for Rozenite plugin communication. `connectFakePair()` gives you both ends of an in-memory `Channel`, so a plugin's panel and `react-native.ts` code can be run against each other in Node, without Metro or a simulator. `waitForMessage`, `waitForChannelMessage`, and the RPC-aware `waitForRpcFrame` wait for a matching message with a required timeout, rejecting with a clear error on expiry instead of hanging.

  This is built on a new `channel` option on `@rozenite/plugin-bridge`'s `getRozeniteDevToolsClient` and `useRozeniteDevToolsClient`, which lets a caller supply its own `Channel` instead of resolving one from the environment. Production behavior is unchanged when it's left unset.

  It also adds `RozeniteChannelProvider` (re-exported from `@rozenite/testing`), which supplies a `Channel` to every `useRozeniteDevToolsClient()` in a subtree. That makes a plugin's own panel components renderable with React Testing Library against a fake pair, unmodified, without a `channel` prop threaded through them for tests. Its optional `role` prop declares which side of the protocol the subtree stands in for, so a panel-side test does not emit the device-only `plugin-mounted` message. There is no provider in production, where channel resolution is unchanged.

### Patch Changes

- Updated dependencies [[`158f4e5`](https://github.com/callstackincubator/rozenite/commit/158f4e5406d6428e24164bdde82d459030fa7309)]:
  - @rozenite/plugin-bridge@2.3.0
