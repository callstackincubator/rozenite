---
'@rozenite/runtime': patch
'@rozenite/middleware': patch
---

Fix host-to-device messages being silently dropped when their payload
contained a character outside the Basic Multilingual Plane (for example an
emoji). Messages were sent by interpolating a JSON string into a JS source
string that the device's JS engine had to recompile, which cannot represent
such characters and failed the recompilation without surfacing an error —
losing the message. Sends now go through `Runtime.callFunctionOn` with the
payload passed as a value argument instead, and a failed send is now reported
instead of being silently swallowed. Sends also no longer wait for the device
to acknowledge the round trip, since delivery order is already guaranteed by
the underlying protocol.
