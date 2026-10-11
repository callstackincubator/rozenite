---
'@rozenite/redux-devtools-plugin': minor
---

`list-actions` now pages with the shared agent cursor: pass the
`page.nextCursor` of one page as `cursor` to get the next, which starts after
the last action returned, so actions dispatched while an agent pages are
never skipped or repeated. `offset` keeps working but is deprecated. The
result keeps `total`, `offset` (the index of the first action returned) and
`limit`, and gains `page`. `list-stores` declares its rows, so agents can
project its columns with `--fields`.

Default changes, each reachable through an argument:

- `list-actions` page size: 50 → 20 (`limit` up to 100).
- `list-actions` default columns: every field → `actionId,type,timestamp,isCurrent`
  (`--fields all` brings back the rest). The CLI prints `total` with each
  page instead of the `store` summary, which the SDK result still carries.
- `get-store-state` and `get-action-details` values: unbounded → 4 levels
  deep and 512 characters per string, with cuts marked `[object(N keys)]`,
  `[array(N)]` or `[+N chars]` and `truncated: true`. Raise them with
  `maxDepth` / `maxValueLength`, or read one sub-tree with `path`.
- `get-action-details`: the state after the action → returned only with
  `include: ["state"]` (or a `path` starting with `state`).
