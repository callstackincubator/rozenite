---
'@rozenite/storage-plugin': patch
---

Fix the Storage panel losing its storages after an app reload. The device now
announces itself once it is listening, so the panel runs discovery again instead
of waiting forever on a request that was sent before the app finished mounting.
