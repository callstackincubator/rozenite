# Task 12: Cut the storage panel over to paginated previews

**Status:** Pending

## Outcome

The visible storage table is powered by bounded preview pages and the shared virtualized table. Details and editing fetch one full value on demand. Refresh always purges pages and restarts from page one.

## Dependencies

- Task 04
- Task 06
- Task 07
- Task 08
- Task 09
- Task 10
- Task 11

## Read first

- `docs/workplace/plan.md`
- New storage query hooks
- New shared virtualized table
- Current `panel.tsx`, entry dialogs, and value rendering

## Scope

- Replace client-side entry filtering with debounced device-owned key search.
- Preserve key sorting through the device request and remove misleading global type/value sort affordances.
- Flatten retained preview pages into virtualized rows.
- Connect guarded next/previous fetches to virtualizer edge callbacks.
- Render only preview text and size/truncation affordances in rows.
- Fetch a full entry before opening details or editing.
- Keep create, edit, delete, import, and export functional through their device operations.
- Implement always-visible Refresh with full reset semantics and scroll-to-top.
- Remove full entry arrays from panel state, but retain legacy protocol code until Task 16.

## Acceptance criteria

- [ ] Scrolling, searching, refreshing, details, editing, CRUD, import, and export work end to end.
- [ ] The panel retains only bounded preview pages and at most one interaction-scoped full value.
- [ ] Refresh cancels work, drops pages/full value, preserves target/search/key sort, scrolls to top, and fetches only page one.

## Verification

- [ ] Add panel tests for edge loading, search reset, stale responses, full-value lifecycle, mutations, and Refresh.
- [ ] Run storage-plugin and UI test/typecheck/lint/build commands.
- [ ] Manually exercise the complete storage workflow in the playground.

## Self-review focus

Check loaded-page sorting claims, double edge fetches, scroll anchoring after eviction, stale dialogs, search debounce cleanup, manual array patching, and regressions to every existing action.

## Likely files

- `packages/storage-plugin/src/ui/panel.tsx`
- `packages/storage-plugin/src/ui/entry-value.tsx`
- New storage table component or focused panel hooks
- Panel tests

## Commit

Create one commit after self-review, for example:

`perf(storage-plugin): virtualize paginated entry previews`
