---
'@rozenite/storage-plugin': minor
---

`list-entries` now pages with the shared agent cursor: the next page starts
after the last key returned, so keys written or removed while an agent pages
are never skipped or repeated, and a cursor whose key was removed answers
`reset: true` instead of an error. A cursor issued for another storage is
still rejected. An invalid `limit` is now an error instead of quietly
falling back to 20. The deprecated `offset` argument keeps working.
`list-storages` declares its rows, so agents can project its columns with
`--fields`. The CLI now prints `total` with each page and leaves out
`adapterId` and `storageId`, which the SDK result still carries.

Default change: `list-entries` rows come in key order (the order the panel
shows them) instead of the order the storage happened to return its keys
in, which for MMKV and AsyncStorage can change after any write. A stable
order is what lets a cursor resume without skipping or repeating a key.
