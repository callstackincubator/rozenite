# Task 06: Add device-owned key search and preview pagination

**Status:** Pending

## Outcome

The device serves cursor-paginated entry previews for one storage. Search is case-insensitive, key-only, and applied before pagination. The legacy snapshot endpoint remains available.

## Dependencies

- Task 01
- Task 02
- Task 03

## Read first

- `docs/workplace/plan.md`
- `packages/storage-plugin/src/react-native/storage-view.ts`
- `packages/storage-plugin/src/shared/messaging.ts`
- Existing blacklist behavior and agent pagination code

## Scope

- Add `listEntryPreviews` to `StorageView` or an equivalent focused service.
- Validate and cap page limits.
- Define opaque next and previous cursor semantics.
- Apply blacklist and normalized key search before page selection.
- Apply ascending or descending key ordering before pagination.
- Read only page values with bounded concurrency.
- Return reset-aware structured errors for invalid/stale cursors.
- Add protocol handlers without removing legacy snapshots.

## Acceptance criteria

- [ ] A page request reads no more values than its capped page size.
- [ ] Search and key sorting never inspect values and pagination operates over the complete matching key set.
- [ ] First, next, previous, empty, final, invalid-cursor, blacklist, and concurrent-read cases are tested.

## Verification

- [ ] Run focused pagination and device-handler tests.
- [ ] Run storage-plugin test, typecheck, and lint commands.

## Self-review focus

Check cursor stability, deterministic ordering, non-finite limits, bounded concurrency, Promise rejection behavior, and whether full values escape the preview conversion boundary.

## Likely files

- `packages/storage-plugin/src/react-native/storage-view.ts`
- `packages/storage-plugin/src/shared/messaging.ts`
- `packages/storage-plugin/src/shared/types.ts`
- Pagination tests

## Commit

Create one commit after self-review, for example:

`feat(storage-plugin): paginate entry previews on device`
