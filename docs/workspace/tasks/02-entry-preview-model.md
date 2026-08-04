# Task 02: Define bounded storage entry previews

**Status:** Pending

## Outcome

The storage package has a tested, adapter-independent preview model and conversion function. This task does not change the current snapshot UI.

## Dependencies

None.

## Read first

- `docs/workplace/plan.md`
- `packages/storage-plugin/src/shared/types.ts`
- `packages/storage-plugin/src/ui/binary.ts`
- MMKV, AsyncStorage, and SecureStore adapter value shapes

## Scope

- Add `StorageEntryPreview` and named preview-size constants.
- Convert each `StorageEntry` type into display text, `valueSize`, and `isTruncated`.
- Keep preview generation usable on the device without importing UI modules.
- Cover empty, boundary-sized, oversized, Unicode string, and buffer cases.

## Acceptance criteria

- [ ] Long strings and buffers are truncated at fixed, tested boundaries.
- [ ] Short values are represented completely with `isTruncated: false`.
- [ ] Preview code lives in shared/device-safe code and has no React dependency.

## Verification

- [ ] Run the focused preview tests.
- [ ] Run `pnpm --filter @rozenite/storage-plugin typecheck`.
- [ ] Run `pnpm --filter @rozenite/storage-plugin lint`.

## Self-review focus

Check Unicode length semantics, buffer size reporting, accidental full-value copies, stable formatting, and whether limits can be bypassed.

## Likely files

- `packages/storage-plugin/src/shared/types.ts`
- `packages/storage-plugin/src/shared/entry-preview.ts`
- `packages/storage-plugin/src/shared/__tests__/entry-preview.test.ts`

## Commit

Create one commit after self-review, for example:

`feat(storage-plugin): add bounded entry previews`
