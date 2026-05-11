---
"@rozenite/network-activity-plugin": patch
---

Fix `react-native-nitro-fetch` not being resolved correctly in Metro by isolating the optional dependency import into its own bundle chunk. This ensures the network inspector works reliably even when `react-native-nitro-fetch` is not installed.
