---
'@rozenite/network-activity-plugin': patch
---

Resolve the optional `react-native-nitro-fetch` dependency before React Native finishes initializing so Metro 0.82 does not show an error overlay when the package is not installed.
