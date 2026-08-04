# Task 07: Add on-demand full-entry requests

**Status:** Pending

## Outcome

The device can return one complete entry after an explicit request. Requests are cancellable and correlated, and full values are never added to preview responses or a new cache.

## Dependencies

- Task 01
- Task 03

## Read first

- `docs/workplace/plan.md`
- `packages/storage-plugin/src/react-native/storage-view.ts`
- `packages/storage-plugin/src/shared/messaging.ts`
- `packages/plugin-bridge` request API from Task 01

## Scope

- Add full-entry request, success response, and structured error contracts.
- Resolve target and blacklist rules consistently with preview requests.
- Return the complete `StorageEntry` in one response; do not chunk it.
- Ensure abort/timeout suppresses late delivery.
- Do not connect the endpoint to the panel yet.

## Acceptance criteria

- [ ] One request reads exactly the requested key and returns its complete typed value.
- [ ] Missing, blacklisted, failed, aborted, and concurrent requests are tested.
- [ ] No full-value cache or chunk protocol is introduced.

## Verification

- [ ] Run focused full-entry request tests.
- [ ] Run plugin-bridge and storage-plugin test/typecheck/lint commands as affected.

## Self-review focus

Check stale response delivery, target resolution, blacklist consistency, large buffer representation, and accidental caching.

## Likely files

- `packages/storage-plugin/src/shared/messaging.ts`
- `packages/storage-plugin/src/react-native/useRozeniteStoragePlugin.ts`
- Device-handler tests

## Commit

Create one commit after self-review, for example:

`feat(storage-plugin): fetch full entries on demand`
