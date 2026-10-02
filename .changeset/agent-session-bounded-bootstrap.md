---
'@rozenite/middleware': patch
---

Agent sessions no longer hang when the device stops answering: commands time out after 10 seconds, and session start now fails with a clear error when the device keeps failing to respond or the app does not include the Rozenite runtime, instead of retrying forever.
