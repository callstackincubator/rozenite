# @rozenite/storage-plugin

## 1.7.0-rc.1

### Patch Changes

- Updated dependencies [[`525a35b`](https://github.com/callstackincubator/rozenite/commit/525a35b3afe0b7989b69d591d8db19b99ad0b812)]:
  - @rozenite/agent-bridge@1.7.0-rc.1
  - @rozenite/plugin-bridge@1.7.0-rc.1

## 1.7.0-rc.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.7.0-rc.0
  - @rozenite/plugin-bridge@1.7.0-rc.0

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
