---
'@rozenite/tools': minor
'@rozenite/runtime': patch
'@rozenite/app': patch
'@rozenite/middleware': patch
'@rozenite/lynx': patch
---

Define the host wire contract once in the new `@rozenite/tools/protocol` subpath (handshake constants, close-reason classification, dispatcher expression builders and the binding payload parser), and use it from the DevTools hosts and the Lynx bridge instead of per-package copies. The only change on the wire: the runtime now sends the canonical double-quoted domain literal in `sendMessage` and `initializeDomain` (previously single-quoted), which evaluates to the same value.
