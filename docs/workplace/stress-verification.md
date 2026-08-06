# Storage Plugin Stress Verification

## Deterministic fixture

`packages/storage-plugin/src/react-native/__tests__/stress-verification.test.ts`
constructs 250 asynchronous storages with 1,000 keys each. Reads are delayed
by one millisecond and each returned string is 1 MiB. The fixture uses shared
value data, so it exercises the bridge-preview path without allocating 250 GiB
of test memory.

The test asserts that discovery starts neither key nor value reads, a selected
storage's first request reads no more than the 100-key page cap with at most
four concurrent reads, every other storage remains unread, and key search
reads only its one matching result. Its assertions are count based, not elapsed
time based, to avoid timing-dependent results.

## Invariant evidence

| Plan invariant | Evidence |
| --- | --- |
| Startup and discovery do not read values from all storages | `stress-verification.test.ts` discovery case; `storage-discovery.test.ts` |
| Selecting one storage does not read another | `stress-verification.test.ts` page and search cases |
| Page and search value reads are bounded | `stress-verification.test.ts`; `entry-preview-pagination.test.ts` |
| DOM rows and selector options stay bounded | `packages/ui/src/components/virtualized-data-table.test.tsx`; `storage-selector.test.tsx` |
| Retained preview pages are capped | `use-storage-entries.test.tsx` |
| Closing details releases the full value | `use-storage-entries.test.tsx`; `large-value-viewer.test.tsx` |
| Unsupported storage is idle without polling | `storage-view.test.ts` |
| Subscription invalidations are key-only | `storage-view.test.ts`; `panel.test.tsx` |
| Refresh starts again at the first page | `use-storage-entries.test.tsx`; `panel.test.tsx` |

## Playground checklist

The deterministic fixture covers the large-storage, slow-read, and megabyte
value scenarios in CI. A physical-device profiling pass was not run in this
workspace: no iOS or Android simulator/device is attached, and the Expo
development server therefore has no client to inspect. This is an environment
limitation, not a passed manual result.

When a device is available, use the Storage Plugin playground screen and record
the device, OS, build mode, and observations for the following checks:

- Startup: open DevTools; verify storage discovery does not visibly block the app.
- Scrolling and search: page through a large storage, then search a late key; verify stable scrolling and reset to the first matching page.
- Refresh and details: refresh with a search active, then open and close a 1 MiB entry; verify the list resets and details do not remain after close.
- Mutations and subscriptions: add, edit, and delete a key in subscribed and manual-only storages; verify subscribed storage refreshes through an invalidation and manual storage changes only after Refresh.
- Import and export: import a large snapshot and export the selected storage; verify progress reports counts only and the resulting list refreshes from authoritative previews.

## Validation record

Run from the workspace root after changing this feature:

```sh
pnpm --filter @rozenite/storage-plugin test
pnpm --filter @rozenite/storage-plugin typecheck
pnpm --filter @rozenite/storage-plugin lint
pnpm --filter @rozenite/storage-plugin build
pnpm --filter @rozenite/ui test
pnpm --filter @rozenite/ui typecheck
pnpm --filter @rozenite/ui lint
pnpm --filter @rozenite/ui build
pnpm --filter @rozenite/playground typecheck
pnpm --filter @rozenite/playground lint
pnpm --filter @rozenite/playground web:webpack:build
pnpm format:all
pnpm release:plan
```

### Current environment limitations (2026-08-04)

The checked-out workspace requires pnpm 11.19.0, while the available pnpm is
11.5.1. Every required `pnpm` command, including `pnpm release:plan`, stops at
that version-policy check; it was not bypassed or weakened.

Equivalent installed-binary checks passed for the new stress test, its focused
storage-plugin coverage, the storage-plugin typecheck, the virtualized-table
test, Prettier, and Changesets status. Full package validation remains blocked
by pre-existing incomplete workspace artifacts: the panel test cannot resolve
`@rozenite/plugin-bridge`, the CLI build cannot find `packages/cli/dist/index.js`,
and the playground cannot resolve its workspace plugin packages. The full
storage-plugin test run additionally exposes the existing large-value-viewer
test fixture below its 50,000-character virtualization threshold. UI typecheck
reports existing unused React imports in two UI test files.
