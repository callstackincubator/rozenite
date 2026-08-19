# @rozenite/storage-plugin

## 2.2.0

### Minor Changes

- [#425](https://github.com/callstackincubator/rozenite/pull/425) [`8b373d9`](https://github.com/callstackincubator/rozenite/commit/8b373d929f7bb64438bc63e516e8ad31966f61ba) Thanks [@V3RON](https://github.com/V3RON)! - Add `useConfirmDialog()` to `@rozenite/ui`: an imperative alternative to `ConfirmDialog` that resolves a promise with the user's choice instead of driving `open` from local state. `PluginShell` now mounts `Toast` and `ConfirmDialog.Provider` automatically, so plugin panels no longer need to wrap themselves in `<Toast.Provider>` to use `useToast()`.

  Migrate the feature-flags, storage, and React Hook Form DevTools panels to `useConfirmDialog()`, replacing their declarative confirm/alert dialogs.

- [#416](https://github.com/callstackincubator/rozenite/pull/416) [`f7bfa9c`](https://github.com/callstackincubator/rozenite/commit/f7bfa9c37bf0d3861cad740afb49d215ac8cad5e) Thanks [@V3RON](https://github.com/V3RON)! - Remove the deprecated `@rozenite/mmkv-plugin` package. It has been superseded by `@rozenite/storage-plugin`, which covers MMKV, AsyncStorage, and Expo SecureStore in a single panel and has been the recommended path for MMKV inspection since `@rozenite/storage-plugin` shipped. Migrate by installing `@rozenite/storage-plugin` and registering an MMKV storage adapter.

### Patch Changes

- Updated dependencies [[`dffeda5`](https://github.com/callstackincubator/rozenite/commit/dffeda53c57f491a303108937d4b4ce68054226f), [`8b373d9`](https://github.com/callstackincubator/rozenite/commit/8b373d929f7bb64438bc63e516e8ad31966f61ba), [`4f5fe74`](https://github.com/callstackincubator/rozenite/commit/4f5fe747ca0c6e93d0bf05076c7e2e2ad25fd744), [`db0a792`](https://github.com/callstackincubator/rozenite/commit/db0a79283562dfd889e8e0f478b384ba21cfe5bf), [`b409250`](https://github.com/callstackincubator/rozenite/commit/b409250480260b793c504d536755a5ba933de4fe), [`850e455`](https://github.com/callstackincubator/rozenite/commit/850e45576c41d52e24d6c239ff2947a612406fae), [`0565227`](https://github.com/callstackincubator/rozenite/commit/0565227761c0f52df0f7fbf30d0ac5833ccc4039), [`15f31f0`](https://github.com/callstackincubator/rozenite/commit/15f31f0091c0bf3bbf48a192925f57c20efd8951), [`9f7581e`](https://github.com/callstackincubator/rozenite/commit/9f7581e8a1e4d506a93c30876231fbe21147c0de)]:
  - @rozenite/agent-bridge@2.2.0
  - @rozenite/ui@2.2.0
  - @rozenite/plugin-bridge@2.2.0
  - @rozenite/agent-shared@2.2.0

## 2.1.0

### Patch Changes

- [#369](https://github.com/callstackincubator/rozenite/pull/369) [`9d9d8cd`](https://github.com/callstackincubator/rozenite/commit/9d9d8cdf9d61fb40b0bddbebf7ae2b54d3053ce8) Thanks [@V3RON](https://github.com/V3RON)! - Fix storage entry count becoming stale after invalidation. The entry count is now
  included in the storage invalidation event and updated on the DevTools panel for
  both local and external device-side mutations.

- [#390](https://github.com/callstackincubator/rozenite/pull/390) [`bdafd53`](https://github.com/callstackincubator/rozenite/commit/bdafd534d359dd1bd80fa047d4c25e4ece9a4694) Thanks [@V3RON](https://github.com/V3RON)! - Fix the Storage panel losing its storages after an app reload. The device now
  announces itself once it is listening, so the panel runs discovery again instead
  of waiting forever on a request that was sent before the app finished mounting.
- Updated dependencies [[`3ec6730`](https://github.com/callstackincubator/rozenite/commit/3ec673095da118cd0ac52c33cae0d8b03b0e162a), [`629df05`](https://github.com/callstackincubator/rozenite/commit/629df051e4ef08775a9a4e1a008aba819d7be05d)]:
  - @rozenite/ui@2.1.0
  - @rozenite/agent-bridge@2.1.0
  - @rozenite/agent-shared@2.1.0
  - @rozenite/plugin-bridge@2.1.0

## 2.0.0

### Minor Changes

- [#341](https://github.com/callstackincubator/rozenite/pull/341) [`de396d6`](https://github.com/callstackincubator/rozenite/commit/de396d651d592ac4186f3971d26c8f0551358d64) Thanks [@V3RON](https://github.com/V3RON)! - Add a confirmation-gated action to purge all entries from the selected storage.

- [#341](https://github.com/callstackincubator/rozenite/pull/341) [`de396d6`](https://github.com/callstackincubator/rozenite/commit/de396d651d592ac4186f3971d26c8f0551358d64) Thanks [@V3RON](https://github.com/V3RON)! - Keep large storage inspections responsive by discovering storage metadata first,
  loading bounded key-and-preview pages for the selected storage, and fetching
  full values only when an entry is opened or edited.

- [#349](https://github.com/callstackincubator/rozenite/pull/349) [`1efd15a`](https://github.com/callstackincubator/rozenite/commit/1efd15a28f53c55a5cd0b12a1e96f47e8c28a431) Thanks [@V3RON](https://github.com/V3RON)! - Rebuild the Storage Inspector panel on the shared `@rozenite/ui` design
  system. Storages are now grouped by adapter (MMKV, AsyncStorage, Expo Secure
  Store, …) in a sidebar instead of a single flat dropdown, and the panel gains
  light/dark theming, a redesigned data table, and consistent dialogs for
  adding, editing, importing, and deleting entries.

### Patch Changes

- [#341](https://github.com/callstackincubator/rozenite/pull/341) [`de396d6`](https://github.com/callstackincubator/rozenite/commit/de396d651d592ac4186f3971d26c8f0551358d64) Thanks [@V3RON](https://github.com/V3RON)! - Keep dialog contents visible and unchanged throughout close transitions.

- [#365](https://github.com/callstackincubator/rozenite/pull/365) [`81bddb8`](https://github.com/callstackincubator/rozenite/commit/81bddb87ab29e45804172a4be7595880099384d9) Thanks [@V3RON](https://github.com/V3RON)! - Rebuild the Rozenite Dev Host on shared UI primitives and add a storage-plugin
  initialization flow for exercising storage message interactions during plugin development.
- Updated dependencies [[`a57b914`](https://github.com/callstackincubator/rozenite/commit/a57b91448e6cc9b88bd987bf462f07deef6b0d55), [`fa96bb8`](https://github.com/callstackincubator/rozenite/commit/fa96bb84d53d264b1f30aa7034ec678711a2c6b1), [`de396d6`](https://github.com/callstackincubator/rozenite/commit/de396d651d592ac4186f3971d26c8f0551358d64), [`476a27f`](https://github.com/callstackincubator/rozenite/commit/476a27f5532f4e35ad66feb5c9481b9396592d14), [`81bddb8`](https://github.com/callstackincubator/rozenite/commit/81bddb87ab29e45804172a4be7595880099384d9), [`88c1faf`](https://github.com/callstackincubator/rozenite/commit/88c1faffb6ffdeaaf05bad750cfb8e46470f3ff5), [`6fad9f3`](https://github.com/callstackincubator/rozenite/commit/6fad9f3a3ac8a5c350d2e8b8c8336642aac5f73d), [`222945f`](https://github.com/callstackincubator/rozenite/commit/222945f00049ca8b7a3746478d6a94b7e4ced6a7), [`b42bf95`](https://github.com/callstackincubator/rozenite/commit/b42bf95cd1573e84ce2faefae92c021575709a33)]:
  - @rozenite/agent-bridge@2.0.0
  - @rozenite/agent-shared@2.0.0
  - @rozenite/ui@2.0.0
  - @rozenite/plugin-bridge@2.0.0

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
