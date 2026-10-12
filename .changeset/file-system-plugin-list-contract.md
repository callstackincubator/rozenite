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

- `list-entries` page size: 100 → 20; `limit` is now capped at 100 (it had
  no cap); default columns: every field → `name,isDirectory,size`
  (`--fields all` brings back the rest). An invalid `limit` (0, negative or
  fractional) is now an error instead of being rounded to a whole number of
  at least 1.
- `read-text-file` `maxBytes`: 10000000 → 16384. A file within 10 MB is now
  cut to the requested range rather than refused when it is larger than
  `maxBytes`. A file over 10 MB is read when the range reaches past 10 MB:
  `maxBytes` above 10000000 (or `maxBytes: 0`, as before) reads the whole
  file on the device, and an `offset` past 10 MB reads from there. A range
  never ends inside a multi-byte character.
- `read-image-file`: a base64 data URI → metadata only (`path`,
  `mimeTypeHint`, `size`). `inline: true` returns the data URI, for images
  up to `maxBytes` (default 262144, previously 10000000).
- `export-file`: no size limit → refuses files over `maxBytes` (default 1048576).
