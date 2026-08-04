# Task 08: Decouple export from panel snapshots

**Status:** Pending

## Outcome

Export explicitly requests current data from the selected device storage. It no longer depends on whatever pages or snapshot entries happen to be retained in the panel.

## Dependencies

- Task 01
- Task 03

## Read first

- `docs/workplace/plan.md`
- `packages/storage-plugin/src/shared/snapshot.ts`
- `packages/storage-plugin/src/ui/utils.ts`
- Current export handling in `panel.tsx`

## Scope

- Add an explicit export request/response flow for one selected target.
- Build the versioned snapshot from current device data only after Export is pressed.
- Return one complete export payload; do not add chunking.
- Update the panel to download the response and expose loading/error state.
- Preserve the existing snapshot schema and filename behavior.

## Acceptance criteria

- [ ] Export includes entries not present in any UI page or legacy selected snapshot.
- [ ] Export starts no work before the user presses Export.
- [ ] Success, empty storage, cancellation, target switch, and device failure are tested.

## Verification

- [ ] Run focused export and snapshot tests.
- [ ] Run storage-plugin test, typecheck, and lint commands.
- [ ] Manually export and parse a playground snapshot.

## Self-review focus

Check stale downloads after target changes, duplicate value copies, error cleanup, URL cleanup, blacklist consistency, and schema compatibility.

## Likely files

- `packages/storage-plugin/src/shared/messaging.ts`
- `packages/storage-plugin/src/react-native/useRozeniteStoragePlugin.ts`
- `packages/storage-plugin/src/ui/panel.tsx`
- Export tests

## Commit

Create one commit after self-review, for example:

`refactor(storage-plugin): export directly from device storage`
