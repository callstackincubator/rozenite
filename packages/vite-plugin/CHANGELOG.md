# @rozenite/vite-plugin

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
