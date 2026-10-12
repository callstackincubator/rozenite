---
name: tanstack-query
description: Inspect and manage TanStack Query caches — queries, mutations, refetch, invalidate, and cache clearing.
domain: tanstack-query
---

# TanStack Query Plugin Domain

A Rozenite plugin for inspecting and managing TanStack Query caches in React Native DevTools. Use it to inspect query and mutation state, page through large caches, refetch or invalidate specific queries, and clear caches when needed.

## Domain

- Plugin ID: `@rozenite/tanstack-query-plugin`
- Domain token: `tanstack-query`

## Tools

```
npx rozenite agent tanstack-query get-cache-summary
npx rozenite agent tanstack-query get-online-status
npx rozenite agent tanstack-query set-online-status --online false
npx rozenite agent tanstack-query list-queries
npx rozenite agent tanstack-query get-query-details --queryHash '["todos"]'
npx rozenite agent tanstack-query get-query-details --queryHash '["todos"]' --path data.items.0 --maxDepth 8
npx rozenite agent tanstack-query refetch-query --queryHash '["todos"]'
npx rozenite agent tanstack-query set-query-loading --queryHash '["todos"]' --enabled true
npx rozenite agent tanstack-query set-query-error --queryHash '["todos"]' --enabled true
npx rozenite agent tanstack-query invalidate-query --queryHash '["todos"]'
npx rozenite agent tanstack-query reset-query --queryHash '["todos"]'
npx rozenite agent tanstack-query remove-query --queryHash '["todos"]'
npx rozenite agent tanstack-query clear-query-cache
npx rozenite agent tanstack-query list-mutations
npx rozenite agent tanstack-query get-mutation-details --mutationId 12
npx rozenite agent tanstack-query clear-mutation-cache
```

## Lists

`list-queries` and `list-mutations` return 20 rows per page (`--limit` up to 100), with `total` alongside. When more rows exist the output ends with a `next` command; run it to continue. Paging resumes after the last row returned, so a query or mutation added while you page is not repeated and none is skipped. If that row was removed, the page comes back empty with `reset: true`: list again without `--cursor`.

`list-queries` shows `queryHash`, `status`, `fetchStatus` and `hasError` by default; `queryHash` already spells out the query key. `list-mutations` shows `mutationId`, `mutationKey`, `status` and `hasError`. Pass `--fields queryKey,observersCount,…` or `--fields all` for more. The cache counters are one `get-cache-summary` away.

## Details

`get-query-details` and `get-mutation-details` cut values to 4 levels of nesting, 512 characters per string and 100 items per array or object. Deeper objects read `[object(N keys)]` or `[array(N)]`, cut strings end in `[+N chars]`, a cut array ends in a `"[+N items]"` item, a cut object ends in a `"[+N keys]": true` entry, and `truncated: true` says something was cut. To read further:

- `--path` selects one sub-tree. It starts with the field to read: `data` or `error` for a query, `variables`, `data`, `error`, `context` or `failureReason` for a mutation (`--path data.items.0`).
- `--maxDepth`, `--maxValueLength` and `--maxItems` raise the limits.

## Minimal Flow

Inspection:
`get-cache-summary` or `get-online-status` -> `list-queries` / `list-mutations` -> `get-query-details` / `get-mutation-details`.

Query management:
`refetch-query`, `set-query-loading`, `set-query-error`, `invalidate-query`, `reset-query`, `remove-query`, `set-online-status`.

Cache cleanup:
`clear-query-cache` or `clear-mutation-cache` only when broad cache deletion is intended.
