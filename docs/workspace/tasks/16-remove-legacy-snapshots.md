# Task 16: Remove the legacy snapshot synchronization path

**Status:** Pending

## Outcome

The storage plugin no longer contains runtime snapshot synchronization, all-target snapshot requests, full-entry polling, or UI snapshot state. Versioned import/export snapshot files remain supported.

## Dependencies

- Task 12
- Task 13
- Task 14

## Read first

- `docs/workplace/plan.md`
- Storage messaging, device hook, panel, and snapshot file-schema code
- All storage-plugin tests

## Scope

- Delete runtime `snapshot` and `get-snapshot` messages and handlers.
- Delete `getAllEntries()` only where no explicit export/import path needs it.
- Remove dead full-entry array state and mutation patching from the panel.
- Preserve `shared/snapshot.ts` and its versioned import/export file schema.
- Identify orphaned helpers/tests and remove only those made obsolete by this migration.

## Acceptance criteria

- [ ] Runtime code has no all-storage or selected-storage snapshot synchronization.
- [ ] Import/export files remain backward compatible.
- [ ] All storage UI capabilities continue through discovery, queries, explicit operations, and invalidations.

## Verification

- [ ] Run the complete storage-plugin test/typecheck/lint/build suite.
- [ ] Search for legacy message names and document any intentional file-schema references.
- [ ] Manually run the full playground workflow.

## Self-review focus

Check that cleanup removes concepts rather than relocating them, no runtime path still fetches all values implicitly, file snapshots are not accidentally removed, and no dead subscriptions remain.

## Likely files

- `packages/storage-plugin/src/shared/messaging.ts`
- `packages/storage-plugin/src/react-native/storage-view.ts`
- `packages/storage-plugin/src/react-native/useRozeniteStoragePlugin.ts`
- `packages/storage-plugin/src/ui/panel.tsx`
- Obsolete tests

## Commit

Create one commit after self-review, for example:

`refactor(storage-plugin): remove runtime snapshots`
