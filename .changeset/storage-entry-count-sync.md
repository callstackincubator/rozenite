---
'@rozenite/storage-plugin': patch
---

Fix storage entry count becoming stale after invalidation. The entry count is now
included in the storage invalidation event and updated on the DevTools panel for
both local and external device-side mutations.
