# @rozenite/network-activity-plugin

## 1.9.0

### Patch Changes

- [#240](https://github.com/callstackincubator/rozenite/pull/240) [`0e2a4db`](https://github.com/callstackincubator/rozenite/commit/0e2a4db7943f004b7f52422fbe23b679829e5b57) Thanks [@V3RON](https://github.com/V3RON)! - Rozenite now treats `application/*+json` responses as JSON in Network Activity, so vendor-specific JSON payloads render correctly instead of falling back to plain text.

- [#260](https://github.com/callstackincubator/rozenite/pull/260) [`9cea370`](https://github.com/callstackincubator/rozenite/commit/9cea370c441595eba266f800901656370bb608f8) Thanks [@V3RON](https://github.com/V3RON)! - Fix `react-native-nitro-fetch` not being resolved correctly in Metro by isolating the optional dependency import into its own bundle chunk. This ensures the network inspector works reliably even when `react-native-nitro-fetch` is not installed.

- Updated dependencies []:
  - @rozenite/agent-bridge@1.9.0
  - @rozenite/agent-shared@1.9.0
  - @rozenite/plugin-bridge@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.8.1
  - @rozenite/agent-shared@1.8.1
  - @rozenite/plugin-bridge@1.8.1

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

- [#233](https://github.com/callstackincubator/rozenite/pull/233) [`90e7fb6`](https://github.com/callstackincubator/rozenite/commit/90e7fb603496e3db2a8d6823c04e6686679619cb) Thanks [@V3RON](https://github.com/V3RON)! - Added support for Nitro fetch traffic in Network Activity.

### Patch Changes

- Updated dependencies [[`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a), [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a)]:
  - @rozenite/agent-bridge@1.8.0
  - @rozenite/agent-shared@1.8.0
  - @rozenite/plugin-bridge@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies [[`a826e35`](https://github.com/callstackincubator/rozenite/commit/a826e35ffadcf79b9d2f1bb033666d3b27d40752)]:
  - @rozenite/agent-bridge@1.7.0
  - @rozenite/plugin-bridge@1.7.0

## 1.6.0

### Minor Changes

- [#198](https://github.com/callstackincubator/rozenite/pull/198) [`cc97b14`](https://github.com/callstackincubator/rozenite/commit/cc97b1433b0f6a93864060d980e869e08d7242bd) Thanks [@V3RON](https://github.com/V3RON)! - Add agent tools for inspecting HTTP, WebSocket, and SSE activity in the Network Activity plugin.

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.6.0
  - @rozenite/plugin-bridge@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.5.1

## 1.5.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.5.0

## 1.4.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.4.0

## 1.3.0

### Patch Changes

- [#172](https://github.com/callstackincubator/rozenite/pull/172) Thanks [@crockalet](https://github.com/crockalet)! - Converted FormData entries iterator to an array before reduce to avoid 'reduce is not a function' and keep request body parsing stable.

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.3.0
