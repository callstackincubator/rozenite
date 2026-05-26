# @rozenite/performance-monitor-plugin

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
