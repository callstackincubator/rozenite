# @rozenite/performance-monitor-plugin

## 2.4.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@2.4.0
  - @rozenite/ui@2.4.0

## 2.3.0

### Minor Changes

- [#457](https://github.com/callstackincubator/rozenite/pull/457) [`3a29044`](https://github.com/callstackincubator/rozenite/commit/3a29044d0b72354ff80cb2e044afe7d51b800348) Thanks [@V3RON](https://github.com/V3RON)! - Every official plugin now declares the integrations it supports, so a plugin that cannot work in the environment you are debugging can say so instead of loading and failing.

  Controls, Feature Flags, React Hook Form and TanStack Query import nothing from `react-native` on the device and declare every integration, Lynx included. Plugins built on native modules — SQLite, Storage, File System and Performance Monitor — declare React Native only, and so do Network Activity and Require Profiler: `react-native-web` provides no `TurboModuleRegistry` or `DevSettings`, which their device code calls. The rest use React Native APIs that do have web equivalents, and also declare Rozenite for Web.

### Patch Changes

- Updated dependencies [[`05939d7`](https://github.com/callstackincubator/rozenite/commit/05939d7b1737a2a9ab483c2df786fa84680c8945), [`b758637`](https://github.com/callstackincubator/rozenite/commit/b758637fd6af638d9b214849d390163ce4efda19), [`40a8ccd`](https://github.com/callstackincubator/rozenite/commit/40a8ccd5a186912ea3dd69564e7efd2c016f611c), [`158f4e5`](https://github.com/callstackincubator/rozenite/commit/158f4e5406d6428e24164bdde82d459030fa7309), [`f788719`](https://github.com/callstackincubator/rozenite/commit/f7887194dd15ff6e165f46d215677899c4e4a1ee)]:
  - @rozenite/ui@2.3.0
  - @rozenite/plugin-bridge@2.3.0

## 2.2.0

### Minor Changes

- [#417](https://github.com/callstackincubator/rozenite/pull/417) [`db0a792`](https://github.com/callstackincubator/rozenite/commit/db0a79283562dfd889e8e0f478b384ba21cfe5bf) Thanks [@V3RON](https://github.com/V3RON)! - Rebuild the Performance Monitor DevTools panel on `@rozenite/ui` with a resizable `Split` sidebar/content layout, matching the pattern used by other Rozenite plugin panels. The sidebar switches between "Timeline" — a full-height waterfall (Measures/Metrics/Marks/RN Marks/Resources, filterable by entryType and name), with startup timing also folded into it as derived measures — and "Startup insights", the dedicated startup summary (total startup duration and a per-phase duration breakdown with proportional bars) rebuilt on `@rozenite/ui` primitives. Like Timeline, Startup insights only shows data from an explicitly started session — it never enables recording on its own — and displays a plain "No startup insights recorded" note otherwise. Selecting a waterfall entry opens a resizable detail panel docked to the right, also via `Split`, instead of a separate table row. The toolbar leads with a start/stop toggle next to Clear, and export is a dialog with per-type include toggles, live counts, and toast feedback on success or failure.

### Patch Changes

- Updated dependencies [[`8b373d9`](https://github.com/callstackincubator/rozenite/commit/8b373d929f7bb64438bc63e516e8ad31966f61ba), [`4f5fe74`](https://github.com/callstackincubator/rozenite/commit/4f5fe747ca0c6e93d0bf05076c7e2e2ad25fd744), [`db0a792`](https://github.com/callstackincubator/rozenite/commit/db0a79283562dfd889e8e0f478b384ba21cfe5bf), [`b409250`](https://github.com/callstackincubator/rozenite/commit/b409250480260b793c504d536755a5ba933de4fe), [`850e455`](https://github.com/callstackincubator/rozenite/commit/850e45576c41d52e24d6c239ff2947a612406fae), [`0565227`](https://github.com/callstackincubator/rozenite/commit/0565227761c0f52df0f7fbf30d0ac5833ccc4039), [`15f31f0`](https://github.com/callstackincubator/rozenite/commit/15f31f0091c0bf3bbf48a192925f57c20efd8951), [`9f7581e`](https://github.com/callstackincubator/rozenite/commit/9f7581e8a1e4d506a93c30876231fbe21147c0de)]:
  - @rozenite/ui@2.2.0
  - @rozenite/plugin-bridge@2.2.0

## 2.1.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@2.1.0

## 2.0.0

### Patch Changes

- Updated dependencies [[`476a27f`](https://github.com/callstackincubator/rozenite/commit/476a27f5532f4e35ad66feb5c9481b9396592d14)]:
  - @rozenite/plugin-bridge@2.0.0

## 1.13.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.13.0

## 1.12.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.12.0

## 1.11.0

### Minor Changes

- [#283](https://github.com/callstackincubator/rozenite/pull/283) [`dc7cdce`](https://github.com/callstackincubator/rozenite/commit/dc7cdce3659df004b591ccb3e74c1f3c638702b9) Thanks [@burczu](https://github.com/burczu)! - Add first-class startup insights to the Performance Monitor plugin.

  A new Startup tab (first in the tab order) shows Total startup time and the three key launch phases — Native Launch, JS Bundle, and Initial Mount — with proportional bars so you can see at a glance where startup time is spent. Phases that have not yet completed show as "In progress…"; phases absent from the event stream show as "—". The startup data is derived automatically from React Native's buffered native marks, so no extra instrumentation is required.

- [#285](https://github.com/callstackincubator/rozenite/pull/285) [`d2faeeb`](https://github.com/callstackincubator/rozenite/commit/d2faeeb13c0d2d3171bc21542d1b23810d9d51c1) Thanks [@draggie](https://github.com/draggie)! - Add a waterfall timeline view to Performance Monitor so you can inspect marks, measures, metrics, and resources in one chronological view.

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.11.0

## 1.10.0

### Minor Changes

- [#264](https://github.com/callstackincubator/rozenite/pull/264) [`4c58099`](https://github.com/callstackincubator/rozenite/commit/4c5809934beb7cf139f7337da4706dbc50fe9434) Thanks [@burczu](https://github.com/burczu)! - Expand performance monitor coverage to `resource` and `react-native-mark` entries, and preserve `mark.detail`.

  The panel now has dedicated tabs for **React Native Marks** (the native startup taxonomy like `nativeLaunchStart`, `runJSBundleStart`, …) and **Resources** (HTTP requests captured via `setResourceLoggingEnabled`). The Resources table shows Name / Type / Duration / Size, with the full `PerformanceResourceTiming` breakdown (sizes, all 12 timing phases, `serverTiming` / `workerTiming`) available in the details sidebar. Previously dropped `mark.detail` payloads are now preserved end-to-end and rendered in the Mark Details sidebar. The export modal can include both new entry types and reports their counts in `sessionInfo`.

### Patch Changes

- [#269](https://github.com/callstackincubator/rozenite/pull/269) [`0442184`](https://github.com/callstackincubator/rozenite/commit/04421844d2f902ff484e6c73bbc25b50a25b55b2) Thanks [@burczu](https://github.com/burczu)! - Fix time display precision in the Performance Monitor panel. Durations under 1s now show as integer milliseconds (clock accuracy is 1ms, so `.toFixed(2)` was always faking precision). Durations ≥ 1s show 3 decimals (`1.234s`) for the same 1ms-precision invariant. Wall-clock timestamps (mark `Recorded at`, measure `Start Time` / `End Time`, session `Started`) include their millisecond component in a stable 24h `HH:MM:SS.mmm` format. Non-zero sub-millisecond durations display as `<1ms` instead of `0ms`, so a marker that fired isn't mistaken for "not measured."

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.10.0

## 1.9.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.8.1

## 1.8.0

### Patch Changes

- Updated dependencies [[`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a)]:
  - @rozenite/plugin-bridge@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.7.0

## 1.6.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.5.1

## 1.5.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.5.0

## 1.4.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.4.0

## 1.3.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.3.0
