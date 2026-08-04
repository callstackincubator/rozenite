# Task 17: Bound storage Agent tool work

**Status:** Pending

## Outcome

Storage Agent tools reuse the scalable device primitives where applicable, cap pagination inputs, and avoid enumerating every storage concurrently for counts.

## Dependencies

- Task 06
- Task 07
- Task 16

## Read first

- `docs/workplace/plan.md`
- `packages/storage-plugin/src/shared/agent-tools.ts`
- `packages/storage-plugin/src/react-native/useStorageAgentTools.ts`
- Shared Agent pagination/output-shaping conventions

## Scope

- Validate finite integer offsets/cursors and cap limits.
- Keep `list-entries` key-only; do not add values or value search.
- Avoid concurrent `getAllKeys()` across every storage in `list-storages`; omit or lazily obtain counts according to the finalized contract.
- Keep `read-entry` as an explicit full-value request.
- Reuse target resolution and pagination helpers instead of creating near-duplicates.

## Acceptance criteria

- [ ] Oversized, negative, fractional, and non-finite pagination inputs are handled predictably.
- [ ] Listing storages performs no value reads and no unbounded concurrent key enumeration.
- [ ] Listing entries never returns values; reading one entry still returns its complete value.

## Verification

- [ ] Add or extend Agent tool tests for limits, counts, target resolution, and large values.
- [ ] Run storage-plugin and relevant Agent package test/typecheck/lint commands.

## Self-review focus

Check contract compatibility, output token size, duplicated pagination logic, ambiguous storage selection, and whether count removal/change needs documentation.

## Likely files

- `packages/storage-plugin/src/shared/agent-tools.ts`
- `packages/storage-plugin/src/react-native/useStorageAgentTools.ts`
- Agent tool tests

## Commit

Create one commit after self-review, for example:

`perf(storage-plugin): bound agent storage queries`
