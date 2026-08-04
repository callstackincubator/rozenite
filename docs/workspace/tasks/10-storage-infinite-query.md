# Task 10: Add bounded storage infinite-query state

**Status:** Pending

## Outcome

The storage UI has tested hooks that load cursor pages through TanStack Query, retain a bounded number of preview pages, cancel stale requests, and expose deterministic reset behavior. The legacy table remains the rendered path for this task.

## Dependencies

- Task 01
- Task 06
- Task 07

## Read first

- `docs/workplace/plan.md`
- TanStack Query v5 infinite-query and cancellation documentation through `ctx7`
- `packages/storage-plugin/package.json`
- Current storage panel client lifecycle

## Scope

- Add `@tanstack/react-query` to the storage UI bundle using repository dependency conventions.
- Add a plugin-local `QueryClientProvider` with explicit defaults.
- Implement an entry-preview `useInfiniteQuery` hook with target/search/key-sort query keys, both cursors, positive `maxPages`, and focus refetch disabled.
- Implement an on-demand full-entry hook whose data is dropped immediately after its interaction unmounts or resets.
- Add query-key helpers and a selected-storage reset helper based on `resetQueries`.
- Do not create a custom cache or wrap TanStack Query generically.

## Acceptance criteria

- [ ] Preview pages never exceed configured `maxPages`.
- [ ] Target/search changes cancel or ignore stale responses and start at the first page.
- [ ] Reset purges all selected-storage variants and refetches only the active first page.

## Verification

- [ ] Add hook tests for next/previous pages, eviction, cancellation, errors, and reset.
- [ ] Run storage-plugin test, typecheck, lint, and build commands.

## Self-review focus

Check query-key stability, accidental focus/network retries, provider lifetime, full-value garbage collection, duplicate fetch guards, and behavior when cursors reset.

## Likely files

- `packages/storage-plugin/package.json`
- `pnpm-lock.yaml`
- `packages/storage-plugin/src/ui/query-client.tsx`
- `packages/storage-plugin/src/ui/use-storage-entries.ts`
- Query hook tests

## Commit

Create one commit after self-review, for example:

`feat(storage-plugin): add bounded entry queries`
