# Task 11: Add a shared virtualized data table

**Status:** Pending

## Outcome

`@rozenite/ui` exports an opt-in virtualized table backed by `TableVirtuoso`. Existing `DataTable` and `EditableTable` behavior remains unchanged.

## Dependencies

None. Execute after Task 10 to keep the main worker path topological and focused.

## Read first

- `docs/workplace/plan.md`
- Current React Virtuoso `TableVirtuoso` documentation through `ctx7`
- `packages/ui/src/components/data-table.tsx`
- `packages/ui/src/components/editable-table.tsx`
- Existing direct Virtuoso consumers in the repository

## Scope

- Add a generic `VirtualizedDataTable` using existing TanStack column definitions where practical.
- Support fixed headers, stable row IDs, dynamic heights, empty/loading states, row actions, and start/end callbacks.
- Preserve semantic table elements and accessible names.
- Use stable component definitions outside render paths as required by Virtuoso.
- Keep query knowledge out of the component.
- Do not modify existing consumers or add LegendList.

## Acceptance criteria

- [ ] Rendering a large dataset produces a bounded number of body rows in the DOM.
- [ ] Sorting callbacks, row activation, fixed headers, keyboard use, and dynamic row heights work.
- [ ] Existing `DataTable` and `EditableTable` tests and consumers remain unchanged.

## Verification

- [ ] Add component tests for virtualization boundaries, edge callbacks, accessibility, and row actions.
- [ ] Run `@rozenite/ui` test/typecheck/lint/build commands.

## Self-review focus

Check semantic markup, screen-reader behavior, focus preservation during row recycling, header alignment, unstable callback/component identities, and accidental query coupling.

## Likely files

- `packages/ui/src/components/virtualized-data-table.tsx`
- `packages/ui/src/index.ts`
- `packages/ui/src/components/*.test.tsx`

## Commit

Create one commit after self-review, for example:

`feat(ui): add virtualized data table`
