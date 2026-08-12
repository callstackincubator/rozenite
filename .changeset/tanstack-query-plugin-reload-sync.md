---
'@rozenite/tanstack-query-plugin': patch
---

Fix the TanStack Query panel staying empty after an app reload. The device now
announces itself once it is listening, so the panel pulls the cache again
instead of waiting forever on a request that was sent before the app finished
mounting.
