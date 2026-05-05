---
'@rozenite/middleware': patch
---

Fix scoped Rozenite middleware so agent setup requests still resolve after the
outer `/rozenite` prefix is stripped by Metro integrations.
