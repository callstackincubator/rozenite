# @rozenite/file-system-plugin

## 2.4.0

### Patch Changes

- Updated dependencies [[`3c4905f`](https://github.com/callstackincubator/rozenite/commit/3c4905f9e6a46f456b8ddd1dee209353b9e96c34)]:
  - @rozenite/agent-shared@2.4.0
  - @rozenite/agent-bridge@2.4.0
  - @rozenite/plugin-bridge@2.4.0
  - @rozenite/ui@2.4.0

## 2.3.0

### Minor Changes

- [#457](https://github.com/callstackincubator/rozenite/pull/457) [`3a29044`](https://github.com/callstackincubator/rozenite/commit/3a29044d0b72354ff80cb2e044afe7d51b800348) Thanks [@V3RON](https://github.com/V3RON)! - Every official plugin now declares the integrations it supports, so a plugin that cannot work in the environment you are debugging can say so instead of loading and failing.

  Controls, Feature Flags, React Hook Form and TanStack Query import nothing from `react-native` on the device and declare every integration, Lynx included. Plugins built on native modules — SQLite, Storage, File System and Performance Monitor — declare React Native only, and so do Network Activity and Require Profiler: `react-native-web` provides no `TurboModuleRegistry` or `DevSettings`, which their device code calls. The rest use React Native APIs that do have web equivalents, and also declare Rozenite for Web.

### Patch Changes

- Updated dependencies [[`a1f5280`](https://github.com/callstackincubator/rozenite/commit/a1f5280e785e3db34b23b0877d52ad19c831dc88), [`05939d7`](https://github.com/callstackincubator/rozenite/commit/05939d7b1737a2a9ab483c2df786fa84680c8945), [`b758637`](https://github.com/callstackincubator/rozenite/commit/b758637fd6af638d9b214849d390163ce4efda19), [`40a8ccd`](https://github.com/callstackincubator/rozenite/commit/40a8ccd5a186912ea3dd69564e7efd2c016f611c), [`c5a3cfc`](https://github.com/callstackincubator/rozenite/commit/c5a3cfc90abd6347ab0321590f7ca262896a1465), [`158f4e5`](https://github.com/callstackincubator/rozenite/commit/158f4e5406d6428e24164bdde82d459030fa7309), [`f788719`](https://github.com/callstackincubator/rozenite/commit/f7887194dd15ff6e165f46d215677899c4e4a1ee)]:
  - @rozenite/agent-shared@2.3.0
  - @rozenite/ui@2.3.0
  - @rozenite/plugin-bridge@2.3.0
  - @rozenite/agent-bridge@2.3.0

## 2.2.0

### Minor Changes

- [#418](https://github.com/callstackincubator/rozenite/pull/418) [`7d357c3`](https://github.com/callstackincubator/rozenite/commit/7d357c300c8e73751778914a515ca03b5746d1b9) Thanks [@V3RON](https://github.com/V3RON)! - Rebuild the File System DevTools panel on `@rozenite/ui`: a sidebar shows a persistent, lazily-loaded directory tree per root, and the content pane lists the selected directory's entries in a sortable table with a per-row export action, above a toolbar carrying the current path with copy-to-clipboard alongside reload and import. Selecting a file opens a detail pane with a sticky path bar (copy, export, and close), a collapsible metadata card, and the image/text preview in one scroll region; the pane stays hidden until something is selected. Importing a file now confirms overwrites with a themed dialog instead of a native browser prompt, and the connecting/no-roots states use a consistent empty-state layout.

### Patch Changes

- [#418](https://github.com/callstackincubator/rozenite/pull/418) [`7d357c3`](https://github.com/callstackincubator/rozenite/commit/7d357c300c8e73751778914a515ca03b5746d1b9) Thanks [@V3RON](https://github.com/V3RON)! - Fix the File System panel showing no roots and no files. The plugin's message channel used `file-system` as its `pluginId`, while every other plugin uses its package name — the id the DevTools runtime derives panels from. Once `@rozenite/shell` started routing `pluginId` messages to only that plugin's panels, every `fs:*` reply from the device was addressed to a plugin id no mounted panel claimed and was dropped, so the panel sat on "No file system roots" forever. The channel now uses `@rozenite/file-system-plugin`, matching the package name and the plugin's agent tools.

  Also stop re-announcing `fs:ready` on every render of the host component. The `useFileSystemDevTools` subscription effect depended on the whole `options` object, which is a new value each render for the usual inline-literal call site; each teardown/re-announce made the panel wipe its roots and entries and refetch them.

- Updated dependencies [[`dffeda5`](https://github.com/callstackincubator/rozenite/commit/dffeda53c57f491a303108937d4b4ce68054226f), [`8b373d9`](https://github.com/callstackincubator/rozenite/commit/8b373d929f7bb64438bc63e516e8ad31966f61ba), [`4f5fe74`](https://github.com/callstackincubator/rozenite/commit/4f5fe747ca0c6e93d0bf05076c7e2e2ad25fd744), [`db0a792`](https://github.com/callstackincubator/rozenite/commit/db0a79283562dfd889e8e0f478b384ba21cfe5bf), [`b409250`](https://github.com/callstackincubator/rozenite/commit/b409250480260b793c504d536755a5ba933de4fe), [`850e455`](https://github.com/callstackincubator/rozenite/commit/850e45576c41d52e24d6c239ff2947a612406fae), [`0565227`](https://github.com/callstackincubator/rozenite/commit/0565227761c0f52df0f7fbf30d0ac5833ccc4039), [`15f31f0`](https://github.com/callstackincubator/rozenite/commit/15f31f0091c0bf3bbf48a192925f57c20efd8951), [`9f7581e`](https://github.com/callstackincubator/rozenite/commit/9f7581e8a1e4d506a93c30876231fbe21147c0de)]:
  - @rozenite/agent-bridge@2.2.0
  - @rozenite/ui@2.2.0
  - @rozenite/plugin-bridge@2.2.0
  - @rozenite/agent-shared@2.2.0

## 2.1.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@2.1.0
  - @rozenite/agent-shared@2.1.0
  - @rozenite/plugin-bridge@2.1.0

## 2.0.0

### Patch Changes

- Updated dependencies [[`a57b914`](https://github.com/callstackincubator/rozenite/commit/a57b91448e6cc9b88bd987bf462f07deef6b0d55), [`fa96bb8`](https://github.com/callstackincubator/rozenite/commit/fa96bb84d53d264b1f30aa7034ec678711a2c6b1), [`476a27f`](https://github.com/callstackincubator/rozenite/commit/476a27f5532f4e35ad66feb5c9481b9396592d14)]:
  - @rozenite/agent-bridge@2.0.0
  - @rozenite/agent-shared@2.0.0
  - @rozenite/plugin-bridge@2.0.0

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
