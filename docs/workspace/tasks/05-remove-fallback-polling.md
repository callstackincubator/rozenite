# Task 05: Remove emulated storage subscriptions

**Status:** Pending

## Outcome

Storages without native subscriptions perform no background polling or value reads. Storages with native subscriptions continue to update through the legacy event path until invalidation events replace it later.

## Dependencies

- Task 04

## Read first

- `docs/workplace/plan.md`
- `packages/storage-plugin/src/react-native/storage-view.ts`
- `packages/storage-plugin/src/react-native/useRozeniteStoragePlugin.ts`
- Storage adapter subscription implementations

## Scope

- Delete the interval polling fallback and fingerprint snapshot machinery.
- Make subscription capability explicit on `StorageView` and discovery descriptors.
- Attach listeners only when the underlying adapter provides a native subscription.
- Keep manual Refresh as the update mechanism for unsupported storages.

## Acceptance criteria

- [ ] Tests prove an unsupported storage performs zero reads while idle.
- [ ] Native MMKV subscription behavior still reaches the existing UI.
- [ ] The UI clearly remains refreshable when live updates are unavailable.

## Verification

- [ ] Run focused StorageView and adapter tests.
- [ ] Run storage-plugin test, typecheck, and lint commands.
- [ ] Manually verify both subscription-capable and unsupported storages.

## Self-review focus

Check for leftover intervals, subscriptions surviving cleanup, misleading capability flags, and accidental behavior changes to native subscriptions.

## Likely files

- `packages/storage-plugin/src/react-native/storage-view.ts`
- `packages/storage-plugin/src/react-native/useRozeniteStoragePlugin.ts`
- `packages/storage-plugin/src/shared/types.ts`
- Focused tests

## Commit

Create one commit after self-review, for example:

`perf(storage-plugin): stop polling unsupported storages`
