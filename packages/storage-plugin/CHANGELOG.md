# @rozenite/storage-plugin

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
