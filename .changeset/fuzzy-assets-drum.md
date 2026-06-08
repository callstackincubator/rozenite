---
"@rozenite/file-system-plugin": patch
---

Fix modern Expo FileSystem bundle directory inspection on Android by listing `asset://` entries without statting packaged asset files.
