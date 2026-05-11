---
'@rozenite/storage-plugin': minor
---

Add storage-level JSON import/export to the storage plugin.

You can now export the currently selected storage to a versioned JSON snapshot and import a snapshot back as an upsert. Import validates the file before writing and rejects entries whose types are not supported by the target storage. See the storage plugin docs for the schema and behavior.