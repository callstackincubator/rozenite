# Task 04: Drive the storage selector from discovery

**Status:** Pending

## Outcome

The panel populates its selector from storage descriptors, stops requesting all snapshots, and requests a legacy snapshot only for the selected storage. A Refresh action is always visible and refreshes that selected snapshot during the migration period.

## Dependencies

- Task 03

## Read first

- `docs/workplace/plan.md`
- `packages/storage-plugin/src/ui/panel.tsx`
- `packages/storage-plugin/src/react-native/useRozeniteStoragePlugin.ts`

## Scope

- Request discovery when the panel connects.
- Store descriptors separately from selected entry data.
- Select the first descriptor without triggering an all-storage snapshot request.
- Remove device-initiated eager snapshot pushing.
- Request only the selected target's legacy snapshot until the paginated UI lands.
- Add an always-visible Refresh action for the selected target.

## Acceptance criteria

- [ ] Opening the panel does not request or push snapshots for every storage.
- [ ] Switching storage reads only the newly selected storage.
- [ ] Selector, search, CRUD, import, export, and details remain usable through the legacy selected snapshot.

## Verification

- [ ] Add tests for initial discovery, first selection, storage switching, and Refresh.
- [ ] Run storage-plugin test, typecheck, and lint commands.
- [ ] Manually verify two or more storages in the playground.

## Self-review focus

Check effect dependencies for duplicate requests, stale selected targets, reconnect behavior, loading states, and whether any `target: 'all'` request remains.

## Likely files

- `packages/storage-plugin/src/ui/panel.tsx`
- `packages/storage-plugin/src/react-native/useRozeniteStoragePlugin.ts`
- UI/device tests for request counts

## Commit

Create one commit after self-review, for example:

`perf(storage-plugin): load only the selected storage`
