---
"@rozenite/ui": patch
---

Fix resizable data tables not filling their container: the table now spans the full width of its container, and the empty state of a resizable table (such as an SQLite query with no rows) is centered across the full width instead of being squeezed into the width of its columns.
