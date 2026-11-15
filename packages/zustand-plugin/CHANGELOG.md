# @rozenite/zustand-plugin

## 2.7.0

### Minor Changes

- [#583](https://github.com/callstackincubator/rozenite/pull/583) [`5f1e5c5`](https://github.com/callstackincubator/rozenite/commit/5f1e5c5a3f944ea57cada878afb98b2c3c02ffab) Thanks [@borisyankov](https://github.com/borisyankov)! - Add `@rozenite/zustand-plugin`, a DevTools panel for Zustand stores wrapped in the `rozenite()` middleware. It shows a timeline of named actions with their arguments, recorded automatically from your store's functions, including `set` calls after an `await`. Each change has a diff and a call site symbolicated through Metro. You can jump back to any state the app still holds, export history, edit state live, and call actions from the panel. `persist` stores show their storage key, version and hydration status. Stores you can't wrap can be registered with `observeStore()` instead, which gives everything except action names. Agent tools are included. Works with Zustand 4.4 and newer.

### Patch Changes

- Updated dependencies [[`b25c58d`](https://github.com/callstackincubator/rozenite/commit/b25c58d5e89450d2bc9982b9b672bc2710d21d49)]:
  - @rozenite/ui@2.7.0
  - @rozenite/agent-bridge@2.7.0
  - @rozenite/agent-shared@2.7.0
  - @rozenite/plugin-bridge@2.7.0
