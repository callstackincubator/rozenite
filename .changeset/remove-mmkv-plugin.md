---
'@rozenite/storage-plugin': minor
---

Remove the deprecated `@rozenite/mmkv-plugin` package. It has been superseded by `@rozenite/storage-plugin`, which covers MMKV, AsyncStorage, and Expo SecureStore in a single panel and has been the recommended path for MMKV inspection since `@rozenite/storage-plugin` shipped. Migrate by installing `@rozenite/storage-plugin` and registering an MMKV storage adapter.
