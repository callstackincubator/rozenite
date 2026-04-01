# @rozenite/vite-plugin

## 1.7.0-rc.0

### Patch Changes

- [#211](https://github.com/callstackincubator/rozenite/pull/211) [`9a16f1e`](https://github.com/callstackincubator/rozenite/commit/9a16f1efd2498ad507f269dcffae9a651a8078e9) Thanks [@ziarno](https://github.com/ziarno)! - Fix intermittent runtime crashes caused by faulty bundling when transforming `require()` in the plugin build: the previous interop led to `interopDefault` errors in the React Native bundle.

- [#212](https://github.com/callstackincubator/rozenite/pull/212) [`83269e6`](https://github.com/callstackincubator/rozenite/commit/83269e6719e02776d654f7c111755c164870d44d) Thanks [@V3RON](https://github.com/V3RON)! - Restructure plugin packaging so build outputs are grouped under target-specific `dist/devtools`, `dist/react-native`, and `dist/metro` directories.

  The CLI now keeps builder-managed `package.json` entry fields in sync with generated outputs, React Native `require()` chunks use stable names, and public declaration files are bundled per target entry.

## 1.6.0

## 1.5.1

## 1.5.0

## 1.4.0

## 1.3.0
