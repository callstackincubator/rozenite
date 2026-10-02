---
'@rozenite/tools': minor
'@rozenite/app': patch
'@rozenite/middleware': patch
---

Add `runDispatcherHandshake` and `RozeniteMissingError` to `@rozenite/tools/protocol`, the dispatcher handshake the DevTools hosts share. `@rozenite/app` and `@rozenite/middleware` now use it instead of their own copies; there is no change in behaviour.
