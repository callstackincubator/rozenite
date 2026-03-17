# @rozenite/redux-devtools-plugin

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
