---
'@rozenite/feature-flags-plugin': minor
---

`list-flags` declares its rows, so `rozenite agent feature-flags list-flags`
prints one row per provider (`providerId`, `providerName`, `flags`) and
accepts `--fields`. The tool's result is unchanged.
