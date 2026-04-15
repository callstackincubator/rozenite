---
'@rozenite/sqlite-plugin': minor
---

The SQLite plugin now loads in **development on web** (React Native for Web) instead of staying disabled. Use it when `expo-sqlite` is configured for web (Expo’s WASM and header setup); behavior matches your registered databases in the browser dev session.
