# TanStack Query Plugin Domain

A Rozenite plugin for inspecting and managing TanStack Query caches in React Native DevTools. Use it to inspect query and mutation state, paginate large caches, refetch or invalidate specific queries, and clear caches when needed.

## Domain
- Plugin ID: `@rozenite/tanstack-query-plugin`
- Domain token: discovered at runtime via `rozenite agent domains --session <sessionId>`

## Tools
- `get-cache-summary` -> `{}`
- `get-online-status` -> `{}`
- `set-online-status` -> `{"online":false}`
- `list-queries` -> `{}` | `{"limit":20}` | `{"limit":20,"cursor":"<cursor>"}`
- `get-query-details` -> `{"queryHash":"<queryHash>"}`
- `refetch-query` -> `{"queryHash":"<queryHash>"}`
- `set-query-loading` -> `{"queryHash":"<queryHash>","enabled":true}`
- `set-query-error` -> `{"queryHash":"<queryHash>","enabled":true}`
- `invalidate-query` -> `{"queryHash":"<queryHash>"}`
- `reset-query` -> `{"queryHash":"<queryHash>"}`
- `remove-query` -> `{"queryHash":"<queryHash>"}`
- `clear-query-cache` -> `{}`
- `list-mutations` -> `{}` | `{"limit":20}` | `{"limit":20,"cursor":"<cursor>"}`
- `get-mutation-details` -> `{"mutationId":12}`
- `clear-mutation-cache` -> `{}`

## Minimal Flow
Inspection:
`get-cache-summary` or `get-online-status` -> `list-queries` / `list-mutations` -> `get-query-details` / `get-mutation-details`.

Query management:
`refetch-query`, `set-query-loading`, `set-query-error`, `invalidate-query`, `reset-query`, `remove-query`, `set-online-status`.

Cache cleanup:
`clear-query-cache` or `clear-mutation-cache` only when broad cache deletion is intended.
