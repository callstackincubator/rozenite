---
'@rozenite/plugin-bridge': minor
---

Add `@rozenite/plugin-bridge/testing` so plugin tests can drive `useRozeniteDevToolsClient` without hand-written mocks. The new harness makes delayed DevTools connection explicit, which helps plugin authors cover loading states, bridge lifecycle, and message flows with less test setup.
