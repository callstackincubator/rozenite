# Task 15: Scale the storage selector

**Status:** Pending

## Outcome

The storage selector remains usable with a large number of descriptors without triggering entry reads. It supports finding a storage by adapter or storage name.

## Dependencies

- Task 04
- Task 11

## Read first

- `docs/workplace/plan.md`
- Current selector in `packages/storage-plugin/src/ui/panel.tsx`
- HeroUI Select/ListBox behavior and current documentation through `ctx7`

## Scope

- Measure the existing selector with a large descriptor fixture.
- Add local descriptor-name search; this search does not query entry keys or values.
- Virtualize selector items only if the measured DOM behavior is unbounded.
- Preserve selected target identity, keyboard navigation, accessible labels, and empty states.
- Do not request counts or snapshots to enrich selector options.

## Acceptance criteria

- [ ] Thousands of descriptors do not create thousands of mounted selector options when open.
- [ ] Adapter/storage-name search and keyboard selection work.
- [ ] Selector actions cause zero entry value reads until a storage page is requested.

## Verification

- [ ] Add selector tests with a large descriptor set.
- [ ] Run storage-plugin test/typecheck/lint/build commands.
- [ ] Manually verify keyboard and screen-reader-relevant behavior.

## Self-review focus

Check focus under recycling, duplicate labels, stable target IDs, accidental entry requests, and whether added complexity is justified by the measurement.

## Likely files

- `packages/storage-plugin/src/ui/panel.tsx`
- A focused storage-selector component
- Selector tests

## Commit

Create one commit after self-review, for example:

`perf(storage-plugin): virtualize storage selection`
