# Task 03: Add device-side storage discovery

**Status:** Pending

## Outcome

The device can return storage descriptors without reading keys or values. The legacy snapshot protocol remains available so the current panel continues to work.

## Dependencies

- Task 01

## Read first

- `docs/workplace/plan.md`
- `packages/storage-plugin/src/shared/messaging.ts`
- `packages/storage-plugin/src/react-native/storage-view.ts`
- `packages/storage-plugin/src/react-native/useRozeniteStoragePlugin.ts`

## Scope

- Add request/response contracts for storage discovery.
- Include target, names, capabilities, and native subscription support.
- Implement the device handler without calling `getAllKeys()` or `get()`.
- Add request-boundary validation and structured errors.
- Keep all existing snapshot handlers during this migration step.

## Acceptance criteria

- [ ] Discovery returns one descriptor per configured storage.
- [ ] Tests prove discovery performs zero key and value reads.
- [ ] The existing panel remains functional without modification.

## Verification

- [ ] Run focused messaging and device-handler tests.
- [ ] Run storage-plugin test, typecheck, and lint commands.

## Self-review focus

Check duplicate targets, descriptor ordering, request correlation, adapter exceptions, and accidental storage enumeration.

## Likely files

- `packages/storage-plugin/src/shared/messaging.ts`
- `packages/storage-plugin/src/shared/types.ts`
- `packages/storage-plugin/src/react-native/useRozeniteStoragePlugin.ts`
- New focused tests under `packages/storage-plugin/src/react-native/__tests__/`

## Commit

Create one commit after self-review, for example:

`feat(storage-plugin): add storage discovery protocol`
