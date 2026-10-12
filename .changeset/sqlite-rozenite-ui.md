---
'@rozenite/sqlite-plugin': minor
---

The SQLite panel now uses the shared Rozenite panel design, with a light theme alongside the
dark one. The database explorer, data browser, structure view, SQL editor and the row, drop and
confirmation dialogs all match the other Rozenite panels, and the editor follows the theme. Row
edit and delete actions now sit next to the row number so they stay in reach on wide tables, and
copying results or an error, exporting and saving a query confirm with a toast.

Editing a row no longer overwrites its NULL values: a NULL column stays NULL unless you change
it, instead of being saved as `0`, an empty string or an empty blob. The editor and results
split keeps its size when you switch tabs, and Cmd/Ctrl+S in the editor saves the query once.
