# @rozenite/redux-devtools-plugin

## 1.13.0

### Minor Changes

- [#302](https://github.com/callstackincubator/rozenite/pull/302) [`e1e8761`](https://github.com/callstackincubator/rozenite/commit/e1e8761ebb1ff3ecaa470d2a7a5a86be7acffa5b) Thanks [@draggie](https://github.com/draggie)! - Add symbolicated Redux action traces in the Redux DevTools panel.

- [#301](https://github.com/callstackincubator/rozenite/pull/301) [`a0b62e6`](https://github.com/callstackincubator/rozenite/commit/a0b62e69a7a65a0f3a6571b3afd9453f003f972e) Thanks [@V3RON](https://github.com/V3RON)! - Add Redux state/action sanitizers and stream initial DevTools history with partial state updates to reduce large snapshot pressure.

### Patch Changes

- Updated dependencies [[`7b00844`](https://github.com/callstackincubator/rozenite/commit/7b00844e6439bb7447bc2b61519a6aa6fc1c270f)]:
  - @rozenite/agent-shared@1.13.0
  - @rozenite/agent-bridge@1.13.0
  - @rozenite/plugin-bridge@1.13.0
  - @rozenite/tools@1.13.0

## 1.12.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.12.0
  - @rozenite/agent-shared@1.12.0
  - @rozenite/plugin-bridge@1.12.0
  - @rozenite/tools@1.12.0

## 1.11.0

### Patch Changes

- [#290](https://github.com/callstackincubator/rozenite/pull/290) [`eb0ceae`](https://github.com/callstackincubator/rozenite/commit/eb0ceae4d8f4ee03f58884afa6083ddb5c0d0aa7) Thanks [@V3RON](https://github.com/V3RON)! - Stop sending a redundant state snapshot when the Redux DevTools panel connects. Document `maxAge` memory usage and out-of-memory risks on React Native.

- Updated dependencies []:
  - @rozenite/agent-bridge@1.11.0
  - @rozenite/agent-shared@1.11.0
  - @rozenite/plugin-bridge@1.11.0
  - @rozenite/tools@1.11.0

## 1.10.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.10.0
  - @rozenite/agent-shared@1.10.0
  - @rozenite/plugin-bridge@1.10.0
  - @rozenite/tools@1.10.0

## 1.9.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.9.0
  - @rozenite/agent-shared@1.9.0
  - @rozenite/plugin-bridge@1.9.0
  - @rozenite/tools@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.8.1
  - @rozenite/agent-shared@1.8.1
  - @rozenite/plugin-bridge@1.8.1
  - @rozenite/tools@1.8.1

## 1.8.0

### Minor Changes

- [#222](https://github.com/callstackincubator/rozenite/pull/222) [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a) Thanks [@manapard](https://github.com/manapard)! - Add typed `./sdk` entrypoints for the official agent-enabled plugins backed by
  the same shared tool contracts used at runtime.

  These plugins now publish typed descriptor groups for `session.tools.call(...)`
  workflows, including shared public input/result types, while keeping their
  existing tool names and runtime behavior unchanged. The official agent SDK docs
  and plugin authoring guidance now also document this SDK export pattern,
  including the `network-activity` fallback note for environments without the
  built-in `network` domain.

### Patch Changes

- Updated dependencies [[`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a), [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a)]:
  - @rozenite/agent-bridge@1.8.0
  - @rozenite/agent-shared@1.8.0
  - @rozenite/plugin-bridge@1.8.0
  - @rozenite/tools@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies [[`a826e35`](https://github.com/callstackincubator/rozenite/commit/a826e35ffadcf79b9d2f1bb033666d3b27d40752)]:
  - @rozenite/agent-bridge@1.7.0
  - @rozenite/plugin-bridge@1.7.0
  - @rozenite/tools@1.7.0

## 1.6.0

### Minor Changes

- [#200](https://github.com/callstackincubator/rozenite/pull/200) [`68e8463`](https://github.com/callstackincubator/rozenite/commit/68e8463a162a477347c9dfc48a0c3357a09f6dfe) Thanks [@V3RON](https://github.com/V3RON)! - Add agent tools for inspecting Redux state, action history, and safe store controls.

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.6.0
  - @rozenite/plugin-bridge@1.6.0
  - @rozenite/tools@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.5.1
  - @rozenite/tools@1.5.1

## 1.5.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.5.0
  - @rozenite/tools@1.5.0

## 1.4.0

### Minor Changes

- [#183](https://github.com/callstackincubator/rozenite/pull/183) [`9ceeb53`](https://github.com/callstackincubator/rozenite/commit/9ceeb5338afa9fd8a40863c0b99b1ee6ac1f4d1e) Thanks [@V3RON](https://github.com/V3RON)! - Redux DevTools now uses Rozenite CDP/bridge messaging instead of the previous relay-based flow.

  User-facing improvements:
  - Better reliability for Redux DevTools controls in the plugin panel.
  - Works with Rozenite for Web by enabling the plugin runtime on web targets.
  - Supports naming store instances via `rozeniteDevToolsEnhancer({ name })`, making multi-store apps easier to debug.
  - Playground now demonstrates two independent Redux stores and counters for easier validation.

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.4.0
  - @rozenite/tools@1.4.0

## 1.3.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.3.0
  - @rozenite/tools@1.3.0
