# Task 13: Replace value events with query invalidations

**Status:** Pending

## Outcome

Native subscription changes and plugin-originated mutations send key-only invalidation metadata. The UI refetches authoritative previews instead of receiving or patching full values.

## Dependencies

- Task 12

## Read first

- `docs/workplace/plan.md`
- Current storage event contracts
- Native MMKV subscription adapter
- Query invalidation behavior in the cut-over panel

## Scope

- Add a key-only invalidation event with target, key, and operation when known.
- Translate native subscription callbacks to invalidations without attaching values.
- Route successful create/edit/delete/import operations through invalidation/reset behavior.
- Invalidate the narrowest correct selected-storage query prefix.
- Drop an open full-value result when its key changes.
- Keep unsupported storages free of polling.

## Acceptance criteria

- [ ] Subscription and mutation events contain no entry value.
- [ ] Native external changes and plugin mutations update the visible preview after refetch.
- [ ] Unsupported storages still perform zero background reads.

## Verification

- [ ] Add event-payload and query-invalidation tests.
- [ ] Run storage-plugin test, typecheck, lint, and build commands.
- [ ] Manually verify native subscription changes and manual-refresh-only storage.

## Self-review focus

Check invalidation storms, duplicate mutation refreshes, stale full-value dialogs, import batching, event cleanup, and accidental fallback polling.

## Likely files

- `packages/storage-plugin/src/shared/messaging.ts`
- `packages/storage-plugin/src/react-native/useRozeniteStoragePlugin.ts`
- `packages/storage-plugin/src/ui/panel.tsx` or query hooks
- Focused tests

## Commit

Create one commit after self-review, for example:

`perf(storage-plugin): replace value events with invalidations`
