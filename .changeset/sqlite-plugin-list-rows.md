---
'@rozenite/sqlite-plugin': minor
---

`list-databases` declares its rows, so `rozenite agent sqlite list-databases`
prints the databases as columns (`id`, `name`, `adapterName` by default) and
accepts `--fields` (`--fields all` adds `adapterId`). The tool's result is
unchanged.
