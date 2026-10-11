---
'@rozenite/tanstack-query-plugin': minor
---

`list-queries` and `list-mutations` now page with the shared agent cursor,
keyed by `queryHash` and `mutationId`. A query or mutation added while an
agent pages no longer invalidates its cursor, and a cursor whose row was
removed answers `reset: true` instead of an error. An invalid `limit` is now
an error instead of quietly falling back to 20.

Default changes, each reachable through an argument:

- `list-queries` default columns: `queryHash,queryKey,status,fetchStatus,hasError`
  → `queryHash,status,fetchStatus,hasError` (`queryHash` already spells out
  the key; `--fields queryKey` brings it back).
- Pages printed by the CLI: the full cache summary → `total` only. The SDK
  result still carries the summary, and `get-cache-summary` returns it.
- `get-query-details` / `get-mutation-details` values: unbounded → 4 levels
  deep, 512 characters per string and 100 items per array or object, with
  cuts marked `[object(N keys)]`, `[array(N)]`, `[+N chars]`, a last
  `"[+N items]"` array item or a last `"[+N keys]": true` object entry, and
  `truncated: true`. Raise them with `maxDepth` / `maxValueLength` /
  `maxItems`, or read one sub-tree with `path` (for example `data.items.0`).
