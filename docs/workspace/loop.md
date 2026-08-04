# Storage Scalability Worker Loop

## Purpose

Implement the storage scalability plan one topologically ordered task and one commit at a time. This file defines the repeated worker procedure; it does not replace the architecture or task specifications.

## Sources of truth

Read these before starting any implementation:

1. Repository `AGENTS.md` files that apply to the files in scope.
2. `CONTRIBUTING.md`.
3. `docs/workplace/plan.md` in full.
4. The selected file under `docs/workspace/tasks/` in full.
5. Relevant production code, tests, and package documentation named by the task.

The main plan owns architecture, constraints, and non-goals. The task file owns the current commit's scope, acceptance criteria, and verification. If they conflict, stop and request clarification.

## Selecting work

1. List `docs/workspace/tasks/*.md` in numeric order.
2. Select the first task whose `**Status:**` is `Pending` and whose dependencies are all `Completed`.
3. Work on exactly that task. Do not bundle a later task because the files are nearby.
4. If a task is already partially implemented, inspect history and tests, then finish only its remaining acceptance criteria.

## Iteration procedure

### 1. Establish a clean boundary

- Run `git status --short` and preserve unrelated work.
- Inspect the previous commit and the selected task's dependencies.
- Confirm the current branch/worktree is the intended implementation branch.
- Do not reset, discard, or rewrite user-owned changes.

### 2. Research before editing

- Read all relevant source and tests before changing code.
- Follow repository patterns before introducing new ones.
- When the task involves a library, framework, SDK, API, or CLI, follow the root `AGENTS.md` Context7 procedure and fetch current documentation with `ctx7` before implementation.
- Record any discovered constraint that materially affects the task.
- If evidence contradicts `docs/workplace/plan.md`, stop and ask; do not silently redesign the system.

### 3. Implement only the selected task

- Keep the change additive when the task says the legacy path must remain.
- Preserve every existing UI capability unless the task explicitly replaces its implementation.
- Follow all explicit non-goals in the main plan.
- Add or update focused tests with the implementation.
- Avoid opportunistic refactors and unrelated plugin migrations.
- Do not create a custom cache, emulate missing subscriptions, introduce value chunking, add value search, cache full values, or add LegendList.

### 4. Validate proportionately

Run every verification command in the task file. Also run the smallest relevant checks while iterating so failures remain attributable.

At minimum:

- Focused tests for changed behavior.
- Typecheck for each affected package.
- Lint for each affected package.
- Build when public exports, bundling, or cross-package integration changes.
- `git diff --check` before review.

Use the repository's configured pnpm version. Do not bypass package-manager or supply-chain checks. If the required toolchain cannot run, report the exact blocker and do not claim validation passed.

### 5. Perform a self-review

Self-review is mandatory before every task commit.

Inspect the complete diff against the task's starting commit, not only the last edited file:

```sh
git diff --check
git diff --stat
git diff
```

Review these axes explicitly:

- Correctness: acceptance criteria, edge cases, error paths, races, cleanup.
- Performance: bounded reads, bounded concurrency, bounded pages/DOM, no accidental full-value transfer or retention.
- Architecture: protocol boundaries, query ownership, shared UI independence, no legacy coupling beyond the migration step.
- Compatibility: current UI remains usable and existing consumers compile.
- Security and robustness: validate device-boundary input and avoid exposing raw adapter errors.
- Tests: assertions would fail if the intended behavior regressed.
- Scope: no unrelated edits, generated output, credentials, or local environment files.
- Dead code: identify anything made unreachable; remove it only when the current task authorizes cleanup.

Fix every required finding, rerun affected validation, and repeat review until no required finding remains.

### 6. Complete the task record

Only after implementation, verification, and self-review succeed:

- Change the task file's `**Status:** Pending` to `**Status:** Completed`.
- Check its acceptance and verification boxes that actually passed.
- If a manual check could not run, leave it unchecked and explain why in the commit body or handoff. Do not represent it as completed.

### 7. Commit exactly one task

- Stage only files belonging to the selected task, including its updated task file.
- Review the staged diff with `git diff --cached`.
- Create one conventional commit using the task's suggested message or a more accurate equivalent.
- Do not combine tasks, create fixup commits for later tasks, push, open a PR, or amend unrelated history.

After committing, verify:

```sh
git status --short
git show --stat --oneline HEAD
```

The worktree should be clean except for known pre-existing user changes. The commit must leave the repository buildable and the existing UI usable.

### 8. Hand off or continue

Report:

- Task completed and commit hash.
- User-visible or architectural value delivered.
- Tests/checks run and their results.
- Manual verification performed or omitted.
- Any known limitation relevant to later tasks.
- The next eligible task.

Then begin a new iteration from task selection. Never treat multiple tasks as one continuous unreviewed change.

## Blocking conditions

Stop without committing when:

- The plan and codebase require materially different architecture.
- A dependency task is incomplete or its contract is insufficient.
- Existing user changes overlap and cannot be preserved safely.
- Required validation fails for reasons introduced by the task.
- Completion requires adding something prohibited by the plan.
- A public API decision has multiple materially different outcomes not resolved by the plan.

Document the evidence, attempted safe alternatives, and the specific decision needed.

## Completion condition

The implementation effort is complete only when all task files are marked `Completed`, Task 18 verification is recorded, required version plans exist, and the final worktree passes the repository checks appropriate to every affected package.
