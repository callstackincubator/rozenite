---
'@rozenite/app': patch
'@rozenite/shell': patch
---

Stop installing a second copy of React alongside Rozenite. `@rozenite/app` and `@rozenite/shell` ship prebuilt bundles, so they no longer declare `react`, `react-dom`, and their other bundled packages as runtime dependencies. This fixes the duplicate dependency failure reported by `expo-doctor` when an app's React version differs from the one Rozenite is built with.
