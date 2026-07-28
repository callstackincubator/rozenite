---
'@rozenite/middleware': patch
'rozenite': patch
---

Agent sessions now automatically recover after an app relaunch while keeping their session ID and restoring tools. If a relaunch interrupts profiling or recording, Rozenite reports the lost data instead of returning a misleading empty result.
