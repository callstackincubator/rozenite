---
'@rozenite/performance-monitor-plugin': minor
---

Expand performance monitor coverage to `resource` and `react-native-mark` entries, and preserve `mark.detail`.

The panel now has dedicated tabs for **React Native Marks** (the native startup taxonomy like `nativeLaunchStart`, `runJSBundleStart`, …) and **Resources** (HTTP requests captured via `setResourceLoggingEnabled`). The Resources table shows Name / Type / Duration / Size, with the full `PerformanceResourceTiming` breakdown (sizes, all 12 timing phases, `serverTiming` / `workerTiming`) available in the details sidebar. Previously dropped `mark.detail` payloads are now preserved end-to-end and rendered in the Mark Details sidebar. The export modal can include both new entry types and reports their counts in `sessionInfo`.