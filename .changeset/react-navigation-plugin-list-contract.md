---
'@rozenite/react-navigation-plugin': minor
---

Add the `get-action-details` agent tool, which returns one recorded
navigation action by `id`, including the navigation state after it and the
stack that dispatched it. Its descriptor is exported from `./sdk`.

`list-actions` now pages with the shared agent cursor: pass the
`page.nextCursor` of one page as `cursor` to get the next, which starts after
the last action returned. `offset` keeps working but is deprecated. The
result keeps `total`, `offset` (the index of the first action returned) and
`limit`, and gains `page`. Rows gain `type` and `routeName`, the route the
action targeted. An invalid `limit` (0, negative or fractional) is now an
error instead of being rounded to a whole number between 1 and 100. An
unknown `include` value, or an `include` that is not an array, is an error
that lists the accepted values (`state`, `origin`), on `list-actions` and
`get-action-details` alike.

Default changes, each reachable through an argument:

- `list-actions` page size: 100 → 20 (`limit` up to 100).
- `list-actions` rows: the full history entry with `state` and `origin` →
  `id`, `timestamp`, `type`, `routeName` and `action`. `include: ["state", "origin"]`
  adds the two back, and `get-action-details` returns them for one action.
  The CLI prints `id,timestamp,type,routeName` and `total` by default.
