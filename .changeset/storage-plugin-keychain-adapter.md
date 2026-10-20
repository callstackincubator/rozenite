---
'@rozenite/storage-plugin': minor
---

Add `createKeychainStorageAdapter` to inspect and edit react-native-keychain (iOS Keychain and Android Keystore) entries in the Storage panel.

Storages can now be marked read-only with `capabilities.readOnly`. The panel disables adding, editing, deleting, purging and importing for them, and the device rejects those changes.
