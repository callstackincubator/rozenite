# Storage Plugin Domain

A Rozenite plugin for inspecting multiple storage backends in React Native DevTools. It provides a single inspector for sync and async storages, including MMKV, AsyncStorage, and Expo SecureStore via adapters. Use it for storage inspection and entry mutation across supported adapters.

## Domain

- Plugin ID: `@rozenite/storage-plugin`
- Domain token: `at-rozenite__storage-plugin`

## Tools

- `list-storages` -> `{}`
- `list-entries` -> `{"adapterId":"<adapterId>","storageId":"<storageId>"}` | `{"adapterId":"<adapterId>","storageId":"<storageId>","offset":0,"limit":100}`
- `read-entry` -> `{"adapterId":"<adapterId>","storageId":"<storageId>","key":"<key>"}`
- `create-entry` -> `{"adapterId":"<adapterId>","storageId":"<storageId>","key":"<key>","type":"string","value":"<value>"}`
- `edit-entry` -> `{"adapterId":"<adapterId>","storageId":"<storageId>","key":"<key>","type":"boolean","value":true}`
- `remove-entry` -> `{"adapterId":"<adapterId>","storageId":"<storageId>","key":"<key>"}`

## Minimal Flow

Read:
`list-storages` -> `list-entries` -> `read-entry`.

Mutation:
`create-entry` / `edit-entry` / `remove-entry`.

Use `list-storages` first to learn valid `adapterId`, `storageId`, and supported value types.
