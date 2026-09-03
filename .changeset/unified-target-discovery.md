---
'@rozenite/middleware': minor
'rozenite': minor
'@rozenite/app': minor
'@rozenite/agent-shared': minor
'@rozenite/lynx': minor
---

Targets returned by `rozenite open` and the agent's targets endpoint now
report which integration (React Native or Lynx) serves them, and target
discovery goes through one Rozenite endpoint on both integrations.

`MetroTarget.pageId` is now the page's id within its own device (the
`page` query parameter of `webSocketDebuggerUrl`) instead of the globally
unique `<deviceId>-<pageId>` composite, so reconnecting after a disconnect
correctly lands back on the page that was being debugged.

`rozenite agent targets` now includes each target's `integration` in its
output.

The Lynx dev server no longer drops and re-registers every connected Lynx
client on each of its periodic device-discovery sweeps, which showed up in
Rozenite as a reconnect every fifteen seconds.
