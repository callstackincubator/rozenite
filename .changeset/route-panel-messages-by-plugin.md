---
'@rozenite/shell': patch
---

Route messages carrying a `pluginId` to only the panels of that plugin instead of broadcasting them to every mounted panel. Messages without a `pluginId` (e.g. shell configuration) are still broadcast to all panels, and the host-to-panel and panel-to-host wiring is unchanged.
