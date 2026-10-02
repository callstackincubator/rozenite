---
'@rozenite/tools': minor
'@rozenite/runtime': patch
'@rozenite/app': patch
'@rozenite/middleware': patch
'@rozenite/lynx': patch
---

Define the host wire contract once in the new `@rozenite/tools/protocol` subpath (handshake constants, close-reason classification, dispatcher expression builders and the binding payload parser), and use it from the DevTools hosts and the Lynx bridge instead of per-package copies. No behavior change.
