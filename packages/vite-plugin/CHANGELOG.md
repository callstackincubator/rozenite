# @rozenite/vite-plugin

## 2.2.0

### Patch Changes

- Updated dependencies [[`8b373d9`](https://github.com/callstackincubator/rozenite/commit/8b373d929f7bb64438bc63e516e8ad31966f61ba), [`db0a792`](https://github.com/callstackincubator/rozenite/commit/db0a79283562dfd889e8e0f478b384ba21cfe5bf), [`b409250`](https://github.com/callstackincubator/rozenite/commit/b409250480260b793c504d536755a5ba933de4fe), [`850e455`](https://github.com/callstackincubator/rozenite/commit/850e45576c41d52e24d6c239ff2947a612406fae), [`0565227`](https://github.com/callstackincubator/rozenite/commit/0565227761c0f52df0f7fbf30d0ac5833ccc4039), [`15f31f0`](https://github.com/callstackincubator/rozenite/commit/15f31f0091c0bf3bbf48a192925f57c20efd8951), [`9f7581e`](https://github.com/callstackincubator/rozenite/commit/9f7581e8a1e4d506a93c30876231fbe21147c0de)]:
  - @rozenite/ui@2.2.0

## 2.1.0

### Patch Changes

- Updated dependencies [[`3ec6730`](https://github.com/callstackincubator/rozenite/commit/3ec673095da118cd0ac52c33cae0d8b03b0e162a), [`629df05`](https://github.com/callstackincubator/rozenite/commit/629df051e4ef08775a9a4e1a008aba819d7be05d)]:
  - @rozenite/ui@2.1.0

## 2.0.0

### Minor Changes

- [#340](https://github.com/callstackincubator/rozenite/pull/340) [`4f54f65`](https://github.com/callstackincubator/rozenite/commit/4f54f6594c4ba62c12b44fa65d265c76f9464729) Thanks [@V3RON](https://github.com/V3RON)! - Configure Tailwind CSS v4 automatically for DevTools client panels so plugin
  projects can use Tailwind styles without their own Vite or PostCSS setup. Migrate
  the built-in plugins to Tailwind CSS v4 and remove their redundant build tooling.

- [#365](https://github.com/callstackincubator/rozenite/pull/365) [`81bddb8`](https://github.com/callstackincubator/rozenite/commit/81bddb87ab29e45804172a4be7595880099384d9) Thanks [@V3RON](https://github.com/V3RON)! - Rebuild the Rozenite Dev Host on shared UI primitives and add a storage-plugin
  initialization flow for exercising storage message interactions during plugin development.

### Patch Changes

- [#359](https://github.com/callstackincubator/rozenite/pull/359) [`6ab6fbe`](https://github.com/callstackincubator/rozenite/commit/6ab6fbee1b214b7d42c7a5434bcb909a59d9ffbe) Thanks [@V3RON](https://github.com/V3RON)! - Improve plugin build times by running independent build targets concurrently while preserving all generated outputs.

- Updated dependencies [[`de396d6`](https://github.com/callstackincubator/rozenite/commit/de396d651d592ac4186f3971d26c8f0551358d64), [`81bddb8`](https://github.com/callstackincubator/rozenite/commit/81bddb87ab29e45804172a4be7595880099384d9), [`88c1faf`](https://github.com/callstackincubator/rozenite/commit/88c1faffb6ffdeaaf05bad750cfb8e46470f3ff5), [`6fad9f3`](https://github.com/callstackincubator/rozenite/commit/6fad9f3a3ac8a5c350d2e8b8c8336642aac5f73d), [`222945f`](https://github.com/callstackincubator/rozenite/commit/222945f00049ca8b7a3746478d6a94b7e4ced6a7), [`b42bf95`](https://github.com/callstackincubator/rozenite/commit/b42bf95cd1573e84ce2faefae92c021575709a33)]:
  - @rozenite/ui@2.0.0

## 1.13.0

### Patch Changes

- [#303](https://github.com/callstackincubator/rozenite/pull/303) [`ff97245`](https://github.com/callstackincubator/rozenite/commit/ff972456990e8f2a6c054640aafba22eb4e16544) Thanks [@michaelapollopimentel-svg](https://github.com/michaelapollopimentel-svg)! - Include source files in the published package so the advertised `development` export resolves.

## 1.12.0

## 1.11.0

### Patch Changes

- [#286](https://github.com/callstackincubator/rozenite/pull/286) [`30a35a4`](https://github.com/callstackincubator/rozenite/commit/30a35a422d6a786b1181afb8b2ca17b627e07e80) Thanks [@V3RON](https://github.com/V3RON)! - Improve the Rozenite plugin dev app layout on smaller viewports so panels, navigation, and message details remain usable without horizontal overflow.

## 1.10.0

## 1.9.0

### Minor Changes

- [#254](https://github.com/callstackincubator/rozenite/pull/254) [`7709b30`](https://github.com/callstackincubator/rozenite/commit/7709b30ff013c1366a355b7be86053e6f58ce4ad) Thanks [@V3RON](https://github.com/V3RON)! - Add an in-browser dev test host for Rozenite plugins. You can exercise your plugin without wiring up a playground app: the host shows a message log and lets you dispatch messages to the plugin panel, similar to DevTools messaging during development.

## 1.8.1

## 1.8.0

### Minor Changes

- [#222](https://github.com/callstackincubator/rozenite/pull/222) [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a) Thanks [@manapard](https://github.com/manapard)! - Add plugin `./sdk` entrypoints for typed agent tool descriptors backed by the
  same tool contracts used at runtime.

  The storage plugin now ships `@rozenite/storage-plugin/sdk` with typed
  `storageTools` descriptors and shared tool contract exports, and the Rozenite
  build pipeline now bundles per-target SDK declarations so plugin SDK entrypoints
  publish clean `dist/sdk/index.d.ts` files.

## 1.7.0

### Patch Changes

- [#211](https://github.com/callstackincubator/rozenite/pull/211) [`9a16f1e`](https://github.com/callstackincubator/rozenite/commit/9a16f1efd2498ad507f269dcffae9a651a8078e9) Thanks [@ziarno](https://github.com/ziarno)! - Fix intermittent runtime crashes caused by faulty bundling when transforming `require()` in the plugin build: the previous interop led to `interopDefault` errors in the React Native bundle.

- [#212](https://github.com/callstackincubator/rozenite/pull/212) [`83269e6`](https://github.com/callstackincubator/rozenite/commit/83269e6719e02776d654f7c111755c164870d44d) Thanks [@V3RON](https://github.com/V3RON)! - Restructure plugin packaging so build outputs are grouped under target-specific `dist/devtools`, `dist/react-native`, and `dist/metro` directories.

  The CLI now keeps builder-managed `package.json` entry fields in sync with generated outputs, React Native `require()` chunks use stable names, and public declaration files are bundled per target entry.

## 1.6.0

## 1.5.1

## 1.5.0

## 1.4.0

## 1.3.0
