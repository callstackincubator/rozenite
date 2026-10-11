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
action targeted.

Default changes, each reachable through an argument:

- `list-actions` page size: 100 → 20 (`limit` up to 100).
- `list-actions` rows: the full history entry with `state` and `origin` →
  `id`, `timestamp`, `type`, `routeName` and `action`. `include: ["state", "origin"]`
  adds the two back, and `get-action-details` returns them for one action.
  The CLI prints `id,timestamp,type,routeName` and `total` by default.
