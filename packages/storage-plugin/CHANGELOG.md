# @rozenite/storage-plugin

## 1.13.0

### Patch Changes

- Updated dependencies [[`7b00844`](https://github.com/callstackincubator/rozenite/commit/7b00844e6439bb7447bc2b61519a6aa6fc1c270f)]:
  - @rozenite/agent-shared@1.13.0
  - @rozenite/agent-bridge@1.13.0
  - @rozenite/plugin-bridge@1.13.0

## 1.12.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.12.0
  - @rozenite/agent-shared@1.12.0
  - @rozenite/plugin-bridge@1.12.0

## 1.11.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.11.0
  - @rozenite/agent-shared@1.11.0
  - @rozenite/plugin-bridge@1.11.0

## 1.10.0

### Minor Changes

- [#262](https://github.com/callstackincubator/rozenite/pull/262) [`ea2d273`](https://github.com/callstackincubator/rozenite/commit/ea2d273c7cdb53d3cc8ffc00874cfdacb0972d90) Thanks [@burczu](https://github.com/burczu)! - Add a hex-first UI for binary (`buffer`) storage entries.

  The table cell now shows a short hex preview plus byte count, the detail dialog renders a standard hexdump with offsets and ASCII column, and the add/edit dialogs replace the JSON array textarea with a CodeMirror editor. The editor offers Hex (default) and Base64 modes, normalizes pasted content (raw hex, grouped hex, multiline hex, hexdump rows with offsets/ASCII columns) immediately, and surfaces byte count, ASCII preview, and validation errors below the input. The internal protocol is unchanged: `buffer` values still flow through the existing `number[]` write path.

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.10.0
  - @rozenite/agent-shared@1.10.0
  - @rozenite/plugin-bridge@1.10.0

## 1.9.0

### Minor Changes

- [#246](https://github.com/callstackincubator/rozenite/pull/246) [`3957bfc`](https://github.com/callstackincubator/rozenite/commit/3957bfc4978116a69bd642e93ae0b9cc5caad4f9) Thanks [@V3RON](https://github.com/V3RON)! - Use `@rozenite/storage-plugin` for MMKV instead of `@rozenite/mmkv-plugin`.

  The storage plugin now supports MMKV v3 and v4 and lets you blacklist keys across storages with one pattern.

- [#261](https://github.com/callstackincubator/rozenite/pull/261) [`328dba7`](https://github.com/callstackincubator/rozenite/commit/328dba7c347a99eec5a82cb2592690d66f30a451) Thanks [@burczu](https://github.com/burczu)! - Add storage-level JSON import/export to the storage plugin.

  You can now export the currently selected storage to a versioned JSON snapshot and import a snapshot back as an upsert. Import validates the file before writing and rejects entries whose types are not supported by the target storage. See the storage plugin docs for the schema and behavior.

### Patch Changes

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

- [#222](https://github.com/callstackincubator/rozenite/pull/222) [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a) Thanks [@manapard](https://github.com/manapard)! - Add plugin `./sdk` entrypoints for typed agent tool descriptors backed by the
  same tool contracts used at runtime.

  The storage plugin now ships `@rozenite/storage-plugin/sdk` with typed
  `storageTools` descriptors and shared tool contract exports, and the Rozenite
  build pipeline now bundles per-target SDK declarations so plugin SDK entrypoints
  publish clean `dist/sdk/index.d.ts` files.

- [#228](https://github.com/callstackincubator/rozenite/pull/228) [`0b373c7`](https://github.com/callstackincubator/rozenite/commit/0b373c7e1b3ebf0a80f87f0a7871d55dcf300992) Thanks [@V3RON](https://github.com/V3RON)! - The Storage plugin now runs in **development on web** (React Native for Web) when using Rozenite for Web. AsyncStorage and Expo SecureStore adapters work as on native; **MMKV** stays unavailable in the browser, so the MMKV adapter resolves to an **empty inspector** (same as production) without loading `react-native-mmkv` in your web bundle.

### Patch Changes

- Updated dependencies [[`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a), [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a)]:
  - @rozenite/agent-bridge@1.8.0
  - @rozenite/agent-shared@1.8.0
  - @rozenite/plugin-bridge@1.8.0

## 1.7.0

### Patch Changes

- [`1e4dbf9`](https://github.com/callstackincubator/rozenite/commit/1e4dbf9ee4e2efe82fff515523965c938a1e5d38) Thanks [@V3RON](https://github.com/V3RON)! - Fix the storage plugin so its React Native entry is stripped from production builds correctly, and tighten the storage adapter types to align the async storage adapter with the shared plugin API.

- Updated dependencies [[`a826e35`](https://github.com/callstackincubator/rozenite/commit/a826e35ffadcf79b9d2f1bb033666d3b27d40752)]:
  - @rozenite/agent-bridge@1.7.0
  - @rozenite/plugin-bridge@1.7.0

## 1.6.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.6.0
  - @rozenite/plugin-bridge@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.5.1
  - @rozenite/plugin-bridge@1.5.1

## 1.5.0

### Minor Changes

- [#190](https://github.com/callstackincubator/rozenite/pull/190) [`5ae53a4`](https://github.com/callstackincubator/rozenite/commit/5ae53a4b509adbd8536ea24812f7ca523a95b625) Thanks [@V3RON](https://github.com/V3RON)! - Added Rozenite for Agents support to the Controls, MMKV, React Navigation, and Storage plugins.

### Patch Changes

- Updated dependencies [[`5ae53a4`](https://github.com/callstackincubator/rozenite/commit/5ae53a4b509adbd8536ea24812f7ca523a95b625)]:
  - @rozenite/agent-bridge@1.5.0
  - @rozenite/plugin-bridge@1.5.0

## 1.4.0

### Minor Changes

- [#184](https://github.com/callstackincubator/rozenite/pull/184) [`c447f1e`](https://github.com/callstackincubator/rozenite/commit/c447f1ebe2065b9700de6b4e9d3c4b2b4310b00f) Thanks [@V3RON](https://github.com/V3RON)! - Introduce `@rozenite/storage-plugin` as a generic storage inspector for React Native devtools.

  User-facing changes:
  - Add `useRozeniteStoragePlugin({ storages })` API for registering one or more adapters.
  - Support named storages across adapters so multiple independent stores can be inspected in a single plugin panel.
  - Provide built-in adapters for MMKV, AsyncStorage (including v2 and v3-style usage), and Expo SecureStore.
  - Improve entry workflows in the panel by prefilling the key when an entry is selected, making update/delete actions faster.
  - Add official documentation for the new Storage plugin and guide users from MMKV docs toward the generic plugin path.

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.4.0

## 0.1.0

- Initial release.
- Added generic storage plugin with sync/async adapters.
- Added MMKV, AsyncStorage and Expo SecureStore adapter factories.
- Added capabilities-aware UI and runtime validation.
- Added per-storage blacklist support.
- Added MCP tools for listing, reading and mutating entries.
