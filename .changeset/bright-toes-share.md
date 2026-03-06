---
"@rozenite/storage-plugin": minor
---

Introduce `@rozenite/storage-plugin` as a generic storage inspector for React Native devtools.

User-facing changes:
- Add `useRozeniteStoragePlugin({ storages })` API for registering one or more adapters.
- Support named storages across adapters so multiple independent stores can be inspected in a single plugin panel.
- Provide built-in adapters for MMKV, AsyncStorage (including v2 and v3-style usage), and Expo SecureStore.
- Improve entry workflows in the panel by prefilling the key when an entry is selected, making update/delete actions faster.
- Add official documentation for the new Storage plugin and guide users from MMKV docs toward the generic plugin path.
