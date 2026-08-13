---
'@rozenite/shell': patch
'@rozenite/plugin-bridge': minor
---

Route messages carrying a `pluginId` to only the panels of that plugin instead of broadcasting them to every mounted panel. Messages without a `pluginId` (e.g. shell configuration) are still broadcast to all panels, and the host-to-panel and panel-to-host wiring is unchanged.

`@rozenite/plugin-bridge` now exports `getDevToolsMessage` and `DevToolsPluginMessage`, which `@rozenite/shell` uses to detect a message's target plugin instead of duplicating the same shape check. `getDevToolsMessage` now also requires `pluginId` to be a string, not just present.
