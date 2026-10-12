---
'@rozenite/redux-devtools-plugin': minor
---

`list-actions` now pages with the shared agent cursor: pass the
`page.nextCursor` of one page as `cursor` to get the next, which starts after
the last action returned, so actions dispatched while an agent pages are
never skipped or repeated. `offset` keeps working but is deprecated. The
result keeps `total`, `offset` (the index of the first action returned) and
`limit`, and gains `page`. `list-stores` declares its rows, so agents can
project its columns with `--fields`. An invalid `list-actions` `limit` (0,
negative or fractional) is now an error instead of being rounded up to 1 or
down to an integer.

`get-action-details` checks `include`: an unknown value, or a value that is
not an array, is an error that lists the accepted ones (it was ignored).

Default changes, each reachable through an argument:

- `list-actions` default columns: every field → `actionId,type,timestamp,isCurrent`
  (`--fields all` brings back the rest). The CLI prints `total` with each
  page instead of the `store` summary, which the SDK result still carries.
- `get-store-state` and `get-action-details` values: unbounded → 4 levels
  deep, 512 characters per string and 100 items per array or object, with
  cuts marked `[object(N keys)]`, `[array(N)]`, `[+N chars]`, a last
  `"[+N items]"` array item or a last `"[+N keys]": true` object entry, and
  `truncated: true`. Raise them with `maxDepth` / `maxValueLength` /
  `maxItems` (new), or read one sub-tree with `path`.
- `get-action-details` still returns the state computed after the action by
  default, now bounded like the rest. `include` (new, default `["state"]`)
  leaves it out when given as `[]`.
