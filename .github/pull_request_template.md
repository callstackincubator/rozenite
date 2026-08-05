## Description

Adds schema-level destructive actions to the SQLite DevTools panel:

- Drop the selected table or view from the Structure tab.
- Drop all user tables and views from the selected database.
- Protect both operations with a shared type-to-confirm dialog, SQL preview, counts, and inline errors.

## Related Issue

<!--- This project only accepts pull requests related to open issues -->
<!--- If suggesting a new feature or change, please discuss it in an issue first -->
<!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->
Closes https://github.com/callstackincubator/rozenite/issues/346

## Context

The adapter exposes execution of SQL statements, but not database-file deletion, so “drop database” is implemented honestly as dropping every user table and view while keeping the open database file intact. Single-object drops use the existing query path; the database sweep uses script execution and drops views before tables.

When foreign-key enforcement is enabled, the sweep temporarily disables it and restores the original value on both success and failure paths. Identifiers are quoted with the existing SQLite identifier helper, and the explorer refreshes after a successful mutation.

## Testing

Automated:

- `pnpm --filter @rozenite/sqlite-plugin build`
- `pnpm --filter @rozenite/sqlite-plugin test` — 49 tests passed
- `pnpm --filter @rozenite/sqlite-plugin typecheck`
- `pnpm --filter @rozenite/sqlite-plugin lint`

Manual verification (confirmed in the requested environment):

- Started Metro from `apps/playground` in this worktree.
- Opened the already-installed Rozenite playground on the running iPhone 17 Pro simulator with `agent-device`.
- Opened React Native DevTools at the provided URL with `agent-browser` and exercised the SQLite panel’s table/view and database-level drop flows, including confirmation gating and post-drop explorer state.
