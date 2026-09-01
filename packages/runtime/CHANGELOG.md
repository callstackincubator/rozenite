# @rozenite/runtime

## 2.3.0

### Minor Changes

- [#456](https://github.com/callstackincubator/rozenite/pull/456) [`4afc448`](https://github.com/callstackincubator/rozenite/commit/4afc448f9e7dae4736155f173b7d726e31458d08) Thanks [@V3RON](https://github.com/V3RON)! - Lay the groundwork for refusing a plugin on an integration it doesn't support, instead of loading it and breaking. Plugins can now declare which environments they work in — `react-native`, `react-native-web`, `lynx`, or `lynx-web` — via `integrations` in `rozenite.config.ts`; omitting it defaults to `['react-native']`, and the resolved list is always reported in the plugin manifest. Nothing enforces compatibility yet — that's a follow-up.

  Resolving which integration a connected target actually is takes two halves. The dev server supplies the host it serves (`react-native` or `lynx`), which follows from the installed integration and so cannot be wrong. The other half — whether the target is a browser — is answered by the device itself: both DevTools hosts evaluate a small self-contained expression in the connected runtime during bootstrap, and `resolveIntegration` combines the two. Asking the device is what makes the answer immediate and certain; the alternative was reading React Native's `ReactNativeApplication.metadataUpdated`, an event Rozenite neither emits nor can order, so a host that asked early would report a browser target as native with no way to tell that answer from a real one. A probe that fails leaves the target unknown rather than guessing.

  `@rozenite/middleware`'s `platform` config option, unreleased until now, is renamed to `integration` to avoid colliding with the device-OS meaning `platform` carries everywhere else in the system.

### Patch Changes

- Updated dependencies [[`4afc448`](https://github.com/callstackincubator/rozenite/commit/4afc448f9e7dae4736155f173b7d726e31458d08)]:
  - @rozenite/tools@2.3.0

## 2.2.0

### Patch Changes

- [#405](https://github.com/callstackincubator/rozenite/pull/405) [`485df5b`](https://github.com/callstackincubator/rozenite/commit/485df5bf6d5714246bd9ee8f691d52f408214e82) Thanks [@V3RON](https://github.com/V3RON)! - Reduce DevTools frontend overhead by skipping `JSON.parse` for binding
  messages that cannot be for the `rozenite` domain. Rozenite shares its
  binding with React Native's own React DevTools integration, so every React
  DevTools bridge message (which can carry full component trees) was
  previously parsed and discarded on every call.

## 2.1.0

### Minor Changes

- [#381](https://github.com/callstackincubator/rozenite/pull/381) [`629df05`](https://github.com/callstackincubator/rozenite/commit/629df051e4ef08775a9a4e1a008aba819d7be05d) Thanks [@V3RON](https://github.com/V3RON)! - Add a Plugins screen to shell mode, opened from a new cog button in the sidebar footer. It lists every loaded plugin with its package id, description, installed version, panels, and a link to npm when a newer version is published. The cog shows a dot when any plugin or the runtime itself has an update available. Panel state is preserved while the screen is open. Also fixes the npm version check to use the CDN-cached registry endpoint instead of the rate-limited `/latest` endpoint, and to correctly ignore local builds ahead of npm.

## 2.0.0

### Minor Changes

- [#357](https://github.com/callstackincubator/rozenite/pull/357) [`e88b100`](https://github.com/callstackincubator/rozenite/commit/e88b10051a2e0c56c67202b7ba74fbf3241744de) Thanks [@V3RON](https://github.com/V3RON)! - Show a link to the latest Rozenite release in the DevTools sidebar when an update is available.

- [#355](https://github.com/callstackincubator/rozenite/pull/355) [`ea5a01f`](https://github.com/callstackincubator/rozenite/commit/ea5a01fa86bc5f716896483fa6e1a49c283e6097) Thanks [@V3RON](https://github.com/V3RON)! - Show plugin panels in a unified Rozenite sidebar by default, with an option to
  keep the individual DevTools tabs presentation.

### Patch Changes

- [#364](https://github.com/callstackincubator/rozenite/pull/364) [`dd0146d`](https://github.com/callstackincubator/rozenite/commit/dd0146d0773885fb19d756c60adb81ab5f251ef2) Thanks [@V3RON](https://github.com/V3RON)! - Restore individual plugin panels in legacy tabs mode and keep them grouped at the end of the DevTools tab bar.

- [#360](https://github.com/callstackincubator/rozenite/pull/360) [`893f238`](https://github.com/callstackincubator/rozenite/commit/893f238c9e7015776ccb79915620271785227022) Thanks [@V3RON](https://github.com/V3RON)! - Preserve sidebar panel state by default and respect `destroyOnDetachPlugins`
  when switching panels.

## 1.13.0

## 1.12.0

## 1.11.0

## 1.10.0

## 1.9.0

## 1.8.1

## 1.8.0

## 1.7.0

## 1.6.0

## 1.5.1

## 1.5.0

## 1.4.0

## 1.3.0
