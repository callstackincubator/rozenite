# @rozenite/require-profiler-plugin

## 2.4.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@2.4.0
  - @rozenite/tools@2.4.0
  - @rozenite/ui@2.4.0

## 2.3.0

### Minor Changes

- [#457](https://github.com/callstackincubator/rozenite/pull/457) [`3a29044`](https://github.com/callstackincubator/rozenite/commit/3a29044d0b72354ff80cb2e044afe7d51b800348) Thanks [@V3RON](https://github.com/V3RON)! - Every official plugin now declares the integrations it supports, so a plugin that cannot work in the environment you are debugging can say so instead of loading and failing.

  Controls, Feature Flags, React Hook Form and TanStack Query import nothing from `react-native` on the device and declare every integration, Lynx included. Plugins built on native modules — SQLite, Storage, File System and Performance Monitor — declare React Native only, and so do Network Activity and Require Profiler: `react-native-web` provides no `TurboModuleRegistry` or `DevSettings`, which their device code calls. The rest use React Native APIs that do have web equivalents, and also declare Rozenite for Web.

- [#454](https://github.com/callstackincubator/rozenite/pull/454) [`8753017`](https://github.com/callstackincubator/rozenite/commit/87530175fdaae569a7e17e5d1649d8d88ff91170) Thanks [@V3RON](https://github.com/V3RON)! - Add three ways to act on require timings rather than just read them.

  Modules can now be rolled up by npm package, since that is the granularity decisions are made at — one row reading `lodash, 340ms across 87 modules` is actionable where 87 four-millisecond rows are not. Each package reports its own evaluation time and, separately, its cost including everything it pulled in, so a package nested inside itself is never counted twice.

  Selecting a module shows the require chain that pulled it in, from the chain root down, with each ancestor clickable — the question every profiling session ends on, previously answerable only by reading ancestors off the flame graph by eye.

  Packages evaluated from more than one install location are flagged, since a duplicated dependency costs evaluation time and bundle bytes twice and can break a stateful library outright.

- [#453](https://github.com/callstackincubator/rozenite/pull/453) [`05939d7`](https://github.com/callstackincubator/rozenite/commit/05939d7b1737a2a9ab483c2df786fa84680c8945) Thanks [@V3RON](https://github.com/V3RON)! - Rebuild the Require Profiler DevTools panel on `@rozenite/ui`, so it follows the shared theme and the light/dark switch like every other panel. A sidebar lists every recorded require chain with its duration and module count and can hide chains below a duration threshold, replacing the previous prev/next stepper and options modal — and because durations now travel with the chain list, the threshold applies to chains that have not been opened yet. The main pane switches between the flame graph and a "Top modules" table ranking the chain's modules by self time, a filter box highlights matching frames and narrows the table, and selecting a module opens a detail pane with its self time, total time, dependency count, and path. Require timings are now recorded with `performance.now()` where the runtime provides it, so fast modules no longer all report 0ms.

  The Metro instrumentation now defends its own dev-only boundary, underneath `withRozenite`'s `enabled` gate rather than relying on it alone. `withRozeniteRequireProfiler` accepts an `enabled` option that defaults to `process.env.NODE_ENV !== 'production'`, and the polyfill it injects is guarded by `__DEV__` so Metro strips it from release bundles — covering configs that enable Rozenite unconditionally and setups that apply the wrapper without `withRozenite`.

  `@rozenite/ui` gains a `FlameGraph` component — a themed, responsive flame graph with animated zooming, selection, search highlighting, and a heat legend.

### Patch Changes

- Updated dependencies [[`4afc448`](https://github.com/callstackincubator/rozenite/commit/4afc448f9e7dae4736155f173b7d726e31458d08), [`05939d7`](https://github.com/callstackincubator/rozenite/commit/05939d7b1737a2a9ab483c2df786fa84680c8945), [`b758637`](https://github.com/callstackincubator/rozenite/commit/b758637fd6af638d9b214849d390163ce4efda19), [`40a8ccd`](https://github.com/callstackincubator/rozenite/commit/40a8ccd5a186912ea3dd69564e7efd2c016f611c), [`158f4e5`](https://github.com/callstackincubator/rozenite/commit/158f4e5406d6428e24164bdde82d459030fa7309), [`f788719`](https://github.com/callstackincubator/rozenite/commit/f7887194dd15ff6e165f46d215677899c4e4a1ee)]:
  - @rozenite/tools@2.3.0
  - @rozenite/ui@2.3.0
  - @rozenite/plugin-bridge@2.3.0

## 2.2.0

### Patch Changes

- Updated dependencies [[`4f5fe74`](https://github.com/callstackincubator/rozenite/commit/4f5fe747ca0c6e93d0bf05076c7e2e2ad25fd744)]:
  - @rozenite/plugin-bridge@2.2.0
  - @rozenite/tools@2.2.0

## 2.1.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@2.1.0
  - @rozenite/tools@2.1.0

## 2.0.0

### Patch Changes

- Updated dependencies [[`476a27f`](https://github.com/callstackincubator/rozenite/commit/476a27f5532f4e35ad66feb5c9481b9396592d14)]:
  - @rozenite/plugin-bridge@2.0.0
  - @rozenite/tools@2.0.0

## 1.13.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.13.0
  - @rozenite/tools@1.13.0

## 1.12.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.12.0
  - @rozenite/tools@1.12.0

## 1.11.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.11.0
  - @rozenite/tools@1.11.0

## 1.10.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.10.0
  - @rozenite/tools@1.10.0

## 1.9.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.9.0
  - @rozenite/tools@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.8.1
  - @rozenite/tools@1.8.1

## 1.8.0

### Patch Changes

- Updated dependencies [[`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a)]:
  - @rozenite/plugin-bridge@1.8.0
  - @rozenite/tools@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.7.0
  - @rozenite/tools@1.7.0

## 1.6.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.6.0
  - @rozenite/tools@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.5.1
  - @rozenite/tools@1.5.1

## 1.5.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.5.0
  - @rozenite/tools@1.5.0

## 1.4.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.4.0
  - @rozenite/tools@1.4.0

## 1.3.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.3.0
  - @rozenite/tools@1.3.0
