# Task 14: Keep on-demand large-value interactions responsive

**Status:** Pending

## Outcome

After a user explicitly fetches a very large value, details, copy/download, and editing avoid eager duplicate transformations and unbounded DOM expansion. The value still arrives in one unchunked response and is dropped when the interaction closes.

## Dependencies

- Task 07
- Task 11
- Task 12

## Read first

- `docs/workplace/plan.md`
- `packages/storage-plugin/src/ui/entry-value.tsx`
- Binary conversion/editor files
- `packages/ui/src/components/entry-detail-dialog.tsx`
- Existing virtualized text and hex viewers in the network plugin

## Scope

- Prevent automatic JSON parsing/stringification of pathological strings on dialog open.
- Render large multiline strings and hexdumps with bounded DOM work using an appropriate shared or storage-owned viewer.
- Delay clipboard serialization until Copy is pressed.
- Avoid constructing complete hexdump and ASCII-preview strings when they are not visible.
- Preserve full-value editing; add clear loading/size feedback where synchronous conversion is unavoidable.
- Do not chunk transport or retain values after close.

## Acceptance criteria

- [ ] Opening details for a large string or buffer does not render one DOM node per entire formatted payload.
- [ ] Copy/download/edit still operate on the complete explicitly fetched value.
- [ ] Closing, switching storage, or refreshing releases the full value and derived representations.

## Verification

- [ ] Add tests around lazy parsing, lazy clipboard work, virtualized rendering, and cleanup.
- [ ] Run storage-plugin and UI test/typecheck/lint/build commands as affected.
- [ ] Manually inspect megabyte-scale string and buffer entries.

## Self-review focus

Check hidden full-size copies, JSON parsing, base64/hexdump allocations, recycled row state, editor initialization cost, and cleanup of object URLs or editor instances.

## Likely files

- `packages/storage-plugin/src/ui/entry-value.tsx`
- `packages/storage-plugin/src/ui/binary.ts`
- `packages/storage-plugin/src/ui/binary-value-editor.tsx`
- `packages/ui/src/components/entry-detail-dialog.tsx`
- Focused tests

## Commit

Create one commit after self-review, for example:

`perf(storage-plugin): bound large value rendering`
