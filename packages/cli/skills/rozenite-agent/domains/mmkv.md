# MMKV Plugin Domain

A Rozenite plugin for MMKV storage inspection in React Native DevTools. It provides real-time inspection of MMKV instances, data visualization with type detection (string, number, boolean, buffer), and management: list storages and entries, read/create/edit/remove entries. Use it when the app uses `react-native-mmkv` and exposes instances via `useMMKVDevTools`.

## Domain
- Plugin ID: `@rozenite/mmkv-plugin`
- Domain token: discovered at runtime via `rozenite agent domains --session <sessionId>`

## Tools
- `list-storages` -> `{}`
- `list-entries` -> `{}` | `{"storageId":"<storageId>"}` | `{"storageId":"<storageId>","offset":0,"limit":100}`
- `read-entry` -> `{"key":"<key>"}` | `{"storageId":"<storageId>","key":"<key>"}`
- `create-entry` -> `{"key":"<key>","type":"string","value":"<value>"}` | `{"storageId":"<storageId>","key":"<key>","type":"number","value":1}`
- `edit-entry` -> `{"key":"<key>","type":"string","value":"<value>"}` | `{"storageId":"<storageId>","key":"<key>","type":"boolean","value":true}`
- `remove-entry` -> `{"key":"<key>"}` | `{"storageId":"<storageId>","key":"<key>"}`

## Minimal Flow
`list-storages` -> `list-entries` -> `read-entry`.

Mutation:
`create-entry` / `edit-entry` / `remove-entry`.

If multiple storages exist, include `storageId`.
