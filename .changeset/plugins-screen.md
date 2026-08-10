---
'@rozenite/ui': minor
'@rozenite/shell': minor
'@rozenite/runtime': minor
---

Add a Plugins screen to shell mode, opened from a new cog button in the sidebar footer. It lists every loaded plugin with its package id, description, installed version, panels, and a link to npm when a newer version is published. The cog shows a dot when any plugin or the runtime itself has an update available. Panel state is preserved while the screen is open. Also fixes the npm version check to use the CDN-cached registry endpoint instead of the rate-limited `/latest` endpoint, and to correctly ignore local builds ahead of npm.
