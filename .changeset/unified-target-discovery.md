---
'@rozenite/middleware': minor
'rozenite': minor
'@rozenite/app': minor
'@rozenite/agent-shared': minor
---

Targets returned by `rozenite open` and the agent's targets endpoint now
report which integration (React Native or Lynx) serves them, and target
discovery goes through one Rozenite endpoint on both integrations.

`MetroTarget.pageId` is now the page's id within its own device (the
`page` query parameter of `webSocketDebuggerUrl`) instead of the globally
unique `<deviceId>-<pageId>` composite, so reconnecting after a disconnect
correctly lands back on the page that was being debugged.
