---
name: storage
description: Inspect and mutate entries across multiple storage backends (MMKV, AsyncStorage, Expo SecureStore) via adapters.
domain: storage
---

# Storage Plugin Domain

A Rozenite plugin for inspecting multiple storage backends in React Native DevTools. It provides a single inspector for sync and async storages, including MMKV, AsyncStorage, and Expo SecureStore via adapters. Use it for storage inspection and entry mutation across supported adapters.

## Domain

- Plugin ID: `@rozenite/storage-plugin`
- Domain token: `storage`

## Tools

```
npx rozenite agent storage list-storages
npx rozenite agent storage list-entries --adapterId mmkv --storageId user
npx rozenite agent storage read-entry --adapterId mmkv --storageId user --key token
npx rozenite agent storage create-entry --adapterId mmkv --storageId user --key theme --type string --value dark
npx rozenite agent storage edit-entry --adapterId mmkv --storageId user --key onboarded --type boolean --value true
npx rozenite agent storage remove-entry --adapterId mmkv --storageId user --key theme
```

- `list-storages` lists every adapter and storage with its `adapterId`, `storageId` and supported value types.
- `list-entries` lists keys only, never values, 20 per page (`--limit` up to 100). When more keys exist the output ends with a `next` command; run it to continue. Paging resumes after the last key returned, so keys added or removed while you page are not skipped or repeated. If that key was removed, the page comes back empty with `reset: true`: list again without `--cursor`.
- `read-entry` returns one value in full.
- `create-entry` fails if the key exists; `edit-entry` fails if it does not. `--type` is `string`, `number`, `boolean` or `buffer` and must be one of the storage's supported types. A `buffer` value is a JSON array of bytes: `--value '[1,2,3]'`.

`--adapterId` and `--storageId` can be left out when only one storage matches.

## Minimal Flow

Read:
`list-storages` -> `list-entries` -> `read-entry`.

Mutation:
`create-entry` / `edit-entry` / `remove-entry`.
