# Task 09: Decouple import from retained UI entries

**Status:** Pending

## Outcome

Import preview and execution use current device-owned keys and capabilities. The UI no longer needs a complete entry snapshot to identify new, overwritten, blacklisted, or unsupported entries.

## Dependencies

- Task 01
- Task 03

## Read first

- `docs/workplace/plan.md`
- `packages/storage-plugin/src/shared/snapshot.ts`
- `packages/storage-plugin/src/react-native/import.ts`
- `packages/storage-plugin/src/ui/import-dialog.tsx`
- Current import flow in `panel.tsx`

## Scope

- Add an explicit device-side import preview request for one target.
- Move current-key overwrite detection and blacklist decisions to the device.
- Keep file parsing and schema validation in the UI unless evidence requires otherwise.
- Execute the accepted import without emitting one full-value event per entry.
- Emit bounded progress/result metadata and one completion signal.
- During the migration, keep the legacy table synchronized through a selected-target refresh; Task 13 will map completion to query invalidation after the panel cutover.

## Acceptance criteria

- [ ] Preview correctness does not depend on loaded UI pages or snapshots.
- [ ] Importing many entries does not emit entry values back to the panel.
- [ ] Existing import UX, failure reporting, and snapshot compatibility remain intact.

## Verification

- [ ] Extend import, preview, blacklist, and partial-failure tests.
- [ ] Run storage-plugin test, typecheck, and lint commands.
- [ ] Manually import new and overwriting entries in the playground.

## Self-review focus

Check race behavior between preview and apply, partial failures, progress event volume, target changes, duplicate keys, and whether full values are echoed after writes.

## Likely files

- `packages/storage-plugin/src/shared/messaging.ts`
- `packages/storage-plugin/src/react-native/import.ts`
- `packages/storage-plugin/src/ui/panel.tsx`
- `packages/storage-plugin/src/ui/import-dialog.tsx`
- Import tests

## Commit

Create one commit after self-review, for example:

`refactor(storage-plugin): preview imports on device`
