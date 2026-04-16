---
'@rozenite/middleware': patch
'@rozenite/plugin-bridge': patch
---

Fix agent session startup so `createSession()` waits for mounted plugin registrations to settle before returning, reducing races when calling plugin tools immediately after session creation.
