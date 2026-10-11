---
'@rozenite/file-system-plugin': minor
---

`list-entries` now pages with the shared agent cursor: pass the
`page.nextCursor` of one page as `cursor` to get the next, which starts after
the last entry returned, so files created or deleted while an agent pages are
never skipped or repeated. `offset` keeps working but is deprecated. The
result keeps its `entries` key, `total`, `offset` (the index of the first
entry returned) and `limit`, and gains `page`. `read-text-file` gains
`offset`, and its result gains `totalBytes`, `truncated` and, when
truncated, `nextOffset`.
`list-roots` declares its rows, so agents can project its columns with
`--fields`.

Default changes, each reachable through an argument:

- `list-entries` page size: 100 → 20 (`limit` up to 100); default columns:
  every field → `name,isDirectory,size` (`--fields all` brings back the rest).
- `read-text-file` `maxBytes`: 10000000 → 16384. Larger files are now cut
  rather than refused; 10000000 stays the maximum.
- `read-image-file`: a base64 data URI → metadata only (`path`,
  `mimeTypeHint`, `size`). `inline: true` returns the data URI, for images
  up to `maxBytes` (default 262144, previously 10000000).
- `export-file`: no size limit → refuses files over `maxBytes` (default 1048576).
