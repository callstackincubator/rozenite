---
'@rozenite/agent-shared': minor
'@rozenite/agent-bridge': minor
---

Agent tools that return lists can now page them with `paginateArray`, the
same pager the built-in tools use. Its cursors resume after the last row
returned rather than at an index, so rows added or removed while an agent
pages through a live app are never skipped or repeated; when the row a
cursor points at is gone, the page answers `reset: true` instead. The
`encodeCursor` / `decodeCursor` helpers it uses run in Hermes, Lynx and the
browser.

A paginated tool can now declare `pagination.itemsKey` when its rows are not
under `items`, and `pagination.meta` to name the top-level result keys worth
printing with each page. A tool that returns a list without paging it can
declare `rows` (with `defineRowsAgentToolContract`) so agents can project
its columns with `--fields`. All three are optional; tools that do not
declare them are unchanged.

`paginateArray` requires `keyOf` to return a different key for every row and
throws when two rows share one, instead of paging forever over the
duplicate.

Two helpers for bounded reads, both safe in Hermes, Lynx and the browser
and re-exported from `@rozenite/agent-bridge`:

- `boundValue(value, { maxDepth, maxValueLength, maxItems, path })` returns
  a JSON-safe copy cut to 4 levels, 512 characters per string and 100 array
  items or object keys per level by default, with each cut marked
  (`[object(N keys)]`, `[array(N)]`, `[+N chars]`, a last `"[+N items]"`
  item, a last `"[+N keys]": true` entry) and `truncated` set.
  `normalizeBoundedValueArgs` and `selectValuePath` validate the arguments
  and select a sub-tree. A string cut never splits a surrogate pair.
- `sliceUtf8(text, { offset, maxBytes })` returns `{ slice, totalBytes,
  truncated, nextOffset }`. It never splits a character, never returns more
  than `maxBytes` bytes (unless one character alone is longer), and
  `nextOffset` is the byte index of the first byte not returned.

`CreateAgentSessionResponse` gains an optional `created` flag: `true` when
the request started the session, `false` when it reused a running one.

