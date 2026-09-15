---
'@rozenite/app': patch
'@rozenite/middleware': patch
'@rozenite/runtime': patch
---

Fix host-to-device messages carrying emoji or any other character outside the
Basic Multilingual Plane being silently dropped — editing a stored value that
contains one from the Storage, MMKV, or SQLite panels now reaches the app
instead of looking like it did. A message the device refuses to accept is
reported now, rather than lost without a trace.
