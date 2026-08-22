---
'@rozenite/ui': patch
---

Speed up `RozeniteLoader`'s animation: the default `period` drops from 3600ms
to 2000ms per loop, so it reads as active rather than sluggish. Pass `period`
explicitly to keep the old pace.
