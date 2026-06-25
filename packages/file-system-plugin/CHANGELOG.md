# @rozenite/file-system-plugin

## 1.13.0

### Patch Changes

- Updated dependencies [[`7b00844`](https://github.com/callstackincubator/rozenite/commit/7b00844e6439bb7447bc2b61519a6aa6fc1c270f)]:
  - @rozenite/agent-shared@1.13.0
  - @rozenite/agent-bridge@1.13.0
  - @rozenite/plugin-bridge@1.13.0

## 1.12.0

### Patch Changes

- [#300](https://github.com/callstackincubator/rozenite/pull/300) [`78c381f`](https://github.com/callstackincubator/rozenite/commit/78c381f475dec7a7c84a1dfff2596d6d9010c358) Thanks [@draggie](https://github.com/draggie)! - Fix modern Expo FileSystem bundle directory inspection on Android by listing `asset://` entries without statting packaged asset files.

- Updated dependencies []:
  - @rozenite/agent-bridge@1.12.0
  - @rozenite/agent-shared@1.12.0
  - @rozenite/plugin-bridge@1.12.0

## 1.11.0

### Minor Changes

- [#276](https://github.com/callstackincubator/rozenite/pull/276) [`bf7a59a`](https://github.com/callstackincubator/rozenite/commit/bf7a59a2395bc3aaec6a47e8cd3260f26df74fb2) Thanks [@JKobrynski](https://github.com/JKobrynski)! - Add opt-in single-file import and export support to the File System plugin, including separately gated Rozenite for Agents tools for raw base64 file transfer.

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.11.0
  - @rozenite/agent-shared@1.11.0
  - @rozenite/plugin-bridge@1.11.0

## 1.10.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.10.0
  - @rozenite/agent-shared@1.10.0
  - @rozenite/plugin-bridge@1.10.0

## 1.9.0

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

## 1.7.0

### Minor Changes

- [#208](https://github.com/callstackincubator/rozenite/pull/208) [`0e00086`](https://github.com/callstackincubator/rozenite/commit/0e000864945af00ca5ea6d7f6e65d4c886a4d90f) Thanks [@V3RON](https://github.com/V3RON)! - Adds a filesystem adapter API to the File System plugin, so apps can bring their own filesystem implementation while keeping the existing expoFileSystem and rnfs hook options working.

### Patch Changes

- Updated dependencies [[`a826e35`](https://github.com/callstackincubator/rozenite/commit/a826e35ffadcf79b9d2f1bb033666d3b27d40752)]:
  - @rozenite/agent-bridge@1.7.0
  - @rozenite/plugin-bridge@1.7.0

## 1.6.0

### Minor Changes

- [#177](https://github.com/callstackincubator/rozenite/pull/177) [`a97d71a`](https://github.com/callstackincubator/rozenite/commit/a97d71a9b429483726ec4e6971bea621fa4aa78f) Thanks [@thiagobrez](https://github.com/thiagobrez)! - Introduce `@rozenite/file-system-plugin` for browsing app files and previewing text and image content in React Native DevTools, with read-only agent tools for roots, directory entries, and file previews.

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.6.0
  - @rozenite/plugin-bridge@1.6.0
