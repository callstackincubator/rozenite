# Task 18: Add stress verification and release metadata

**Status:** Pending

## Outcome

The completed implementation has repeatable stress coverage, documented results against the plan's invariants, and the required version plan for affected publishable packages.

## Dependencies

- Tasks 01 through 17

## Read first

- `docs/workplace/plan.md`
- `CONTRIBUTING.md`
- `docs/agents/version-plans.md`
- `apps/playground/README.md`
- Package scripts for every affected package

## Scope

- Add deterministic fixtures for many storages, many entries, slow async reads, and megabyte-scale values.
- Assert device read counts, no unsupported-storage polling, bounded page reads, bounded retained pages, and bounded DOM rows.
- Record manual profiling observations for startup, scrolling, search, Refresh, details, mutations, subscriptions, import, and export.
- Update user/developer documentation where behavior changed.
- Create the required Changeset/version plan with an accurate user-facing summary.
- Do not tune arbitrary micro-optimizations without measured evidence.

## Acceptance criteria

- [ ] Every performance invariant in the main plan is covered by a test or documented manual measurement.
- [ ] All affected package suites and builds pass.
- [ ] The branch contains the required version plan and implementation documentation.

## Verification

- [ ] Run focused package tests, typechecks, lints, and builds.
- [ ] Run repository formatting checks for changed files.
- [ ] Run `pnpm release:plan`.
- [ ] Complete the manual playground stress checklist and record results.

## Self-review focus

Check flaky timing assertions, unrealistic fixtures, missing cross-package validation, undocumented limitations, changeset scope, and whether any plan invariant lacks evidence.

## Likely files

- Stress tests under `packages/storage-plugin`
- Playground storage fixtures
- Storage plugin README or relevant website documentation
- `.changeset/*.md`

## Commit

Create one commit after self-review, for example:

`test(storage-plugin): cover large storage workloads`
