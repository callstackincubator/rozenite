# Storage Plugin Scalability Plan

## Status

Approved foundation for implementation. The worker must treat the decisions and non-goals in this document as requirements. If implementation evidence invalidates a decision, stop and ask for direction instead of silently changing the design.

## Objective

Make `packages/storage-plugin` remain responsive when an application exposes many storage instances, each storage contains many entries, and individual entries contain very large strings or buffers.

The plugin must bound work at every layer:

- Device reads are limited to the selected storage and requested page.
- Bridge messages contain storage metadata, entry previews, invalidations, or one explicitly requested full value.
- The UI renders only the rows around the viewport.
- Full values are neither prefetched nor cached after the interaction that requested them ends.

## Current Problems

The existing snapshot architecture is unbounded:

- The device reads every value in every storage at startup.
- The panel requests all snapshots and retains them in a `Map`.
- Storages without native subscriptions are polled by repeatedly reading all values.
- `getAllEntries()` starts one read per key through an unbounded `Promise.all`.
- The shared `DataTable` renders every row.
- Table cells receive complete string and buffer values.
- Selection changes can recreate subscriptions and request all snapshots again.
- Import, export, and mutation events assume the UI owns complete snapshots.

Virtualizing the current table alone would reduce DOM nodes but would not reduce device I/O, bridge payload size, or retained full-value memory. The data protocol must change first.

## Agreed Architecture

### Storage discovery

The UI first requests storage descriptors. Discovery must not include entries or trigger value reads.

```ts
type StorageDescriptor = {
  target: StorageTarget;
  adapterName: string;
  storageName: string;
  capabilities: StorageCapabilities;
  supportsSubscriptions: boolean;
};
```

Entry counts should not require eagerly enumerating every storage during discovery. They may be omitted or loaded for the selected storage as part of its first entry-page response.

### Device-owned key search and pagination

Search applies only to entry keys and runs on the device. The UI must never filter only its retained pages and present that as a complete search result.

The device endpoint accepts a selected storage, normalized key search, cursor, and bounded limit:

```ts
type ListEntryPreviewsRequest = {
  requestId: string;
  target: StorageTarget;
  search?: string;
  keySortDirection?: 'ascending' | 'descending';
  cursor?: string;
  limit: number;
};

type ListEntryPreviewsResponse = {
  requestId: string;
  target: StorageTarget;
  items: StorageEntryPreview[];
  nextCursor?: string;
  previousCursor?: string;
};
```

The device performs these steps in order:

1. Enumerate keys for the selected storage.
2. Apply blacklist rules.
3. Apply case-insensitive key search.
4. Resolve the requested cursor page.
5. Read values only for that page with bounded concurrency.
6. Convert each value to a bounded preview.
7. Release the full values after the response is sent.

Use cursor-based bidirectional pagination. The virtualized UI loads adjacent pages; it does not require arbitrary offset access, page-number navigation, or jumping to an unloaded row index. Preserve key sorting by applying its direction on the device before pagination. Do not offer global type or value sorting because that would require reading every value; do not sort only the retained pages and present it as a complete ordering.

Cursor validation must fail predictably. A changed search or selected storage starts a new query sequence. If a cursor can no longer be resolved after structural storage changes, the device returns a reset signal and the UI starts from the first page.

### Bounded previews

The table receives only previews:

```ts
type StorageEntryPreview = {
  key: string;
  type: StorageEntryType;
  preview: string;
  valueSize: number;
  isTruncated: boolean;
};
```

Preview policy is owned by the device and uses hard limits shared by all adapters:

- Short strings are returned in full.
- Long strings return a fixed-length prefix.
- Numbers and booleans are returned in full as formatted preview text.
- Buffers return a short hexadecimal prefix.
- `valueSize` communicates the full string length or buffer byte length.
- `isTruncated` tells the UI whether it is showing the complete value.

The exact limits should be named constants with unit tests. They must not be caller-controlled without a hard server-side cap.

### Full values on demand

A full value crosses the bridge only after an explicit user action that needs it:

- Open entry details.
- Open the entry editor.
- Copy or download the full entry.

The request returns the complete `StorageEntry` in one response. Do not chunk the value.

The UI holds the full value only for the lifetime of the detail/editor interaction. Closing the interaction, switching storage, refreshing, or disconnecting drops it. Do not retain full values in infinite-query pages, a separate cache, or panel snapshot state.

The bridge request must support request IDs, cancellation, stale-response rejection, and timeouts. Cancellation may prevent delivery even when the underlying storage read itself cannot be interrupted.

### Query ownership

Use TanStack Query v5 rather than implementing another query/cache engine.

The entry list uses `useInfiniteQuery` with:

- A query key containing the storage target, normalized key search, and key sort direction.
- `getNextPageParam` and `getPreviousPageParam`.
- A positive `maxPages` to bound retained preview pages.
- `refetchOnWindowFocus: false` so focus does not cause implicit device work.
- Query functions that consume TanStack Query's `AbortSignal` through the bridge request client.

The retained pages contain previews only. They are the virtualized list's bounded working set, not a cache of full values.

Do not wrap or reimplement TanStack Query's cache semantics. A small shared connector may flatten retained pages and safely connect `fetchNextPage` and `fetchPreviousPage` to the virtualizer.

### Manual refresh

A Refresh action is visible at all times, including for storages with native subscriptions.

Refreshing the selected storage must:

1. Cancel in-flight page and full-value requests.
2. Purge every retained page for the selected storage, including inactive search variants.
3. Drop the currently loaded full value and close or reset its interaction.
4. Preserve the selected storage, current search term, and key sort direction.
5. Reset the virtual list to the top.
6. Fetch the first page again.

Use `queryClient.resetQueries` with the selected storage's query-key prefix. Active queries refetch from `initialPageParam`; retained infinite pages must not be individually refreshed.

### Subscriptions

Do not emulate subscriptions for storages that lack native subscription support. Users may manually refresh those storages. Background polling would reintroduce unbounded key or value reads.

For storages with native subscriptions:

- Send a key-only invalidation event containing target, key, and operation when known.
- Never include the changed value in the event.
- Invalidate/refetch the active preview query as needed.
- A plugin-originated mutation follows the same invalidation path.

For storages without native subscriptions:

- Perform no background polling.
- Perform no background `getAllKeys()` calls.
- Perform no background value reads.
- External changes become visible on manual refresh, reselection, reconnection, search change, or subsequent page fetch.

The UI may communicate whether live updates are supported, but Refresh remains available in both cases.

### Virtualization

Add a shared virtualized table abstraction to `@rozenite/ui` and use it in the storage plugin.

Use the existing `react-virtuoso` dependency. The first implementation should use `TableVirtuoso` and preserve semantic table markup, fixed headers, stable row keys, dynamic row heights, keyboard behavior, and accessible row actions.

The shared component must remain independent of TanStack Query. It receives rows and edge callbacks such as `onEndReached` and `onStartReached`; the storage query hook decides whether a fetch may start.

Existing `DataTable` and `EditableTable` consumers must continue to work unchanged. Add a new component or an opt-in mode rather than replacing behavior for every plugin in one commit.

Do not add LegendList as part of this plan. Reconsider it only if a measured Virtuoso limitation blocks correct scroll anchoring after bounded-page eviction.

### Mutations

Create, edit, and delete operations continue to execute on the device.

After a successful mutation:

- Do not send the full value back as a change event.
- Invalidate the selected storage's preview queries.
- Drop an open full-value result for the affected key.
- Let the next query response determine the authoritative preview and position.

Avoid patching retained page arrays manually because inserts, deletes, and key ordering can shift page boundaries.

### Import and export

Import and export are explicit bulk operations and must not depend on retained preview pages.

- Export requests complete current data from the device only after the user clicks Export.
- Export may return one complete payload; this plan does not introduce value chunking.
- Import validation and overwrite detection must use device-owned current keys, not the UI's retained pages.
- Import completion invalidates the selected storage query once rather than emitting one full-value event per imported entry.
- Progress events contain counts and errors, not entry values.

### Many storages

The storage selector must not require entry snapshots to populate. If rendering a very large descriptor list becomes measurable, make the selector searchable and virtualized without changing entry-query behavior.

### Agent tools

Agent tools should use the same device primitives where practical:

- `list-entries` remains key-only and paginated.
- Limits are validated and capped.
- `list-storages` must not read every storage concurrently merely to calculate counts.
- `read-entry` remains an explicit on-demand full-value operation.

## Explicit Non-Goals and Prohibited Implementations

The worker must not implement any of the following unless the plan is amended:

- Do not restore or retain full snapshots in the UI.
- Do not fetch all storage values at startup, on selection changes, or on refresh.
- Do not search entry values.
- Do not perform client-only key search over retained pages.
- Do not perform client-only sorting over retained pages or add global type/value sorting.
- Do not preload full values for visible or adjacent rows.
- Do not cache full values on the device or in the UI.
- Do not chunk an explicitly requested full value.
- Do not emulate missing subscriptions with polling.
- Do not send values in subscription or mutation invalidation events.
- Do not add automatic window-focus refetching.
- Do not introduce offset pagination solely to support arbitrary row jumps.
- Do not implement a custom query cache, retry engine, or request deduplication system in place of TanStack Query.
- Do not couple the shared virtualized table to TanStack Query or the storage protocol.
- Do not introduce LegendList in this implementation.
- Do not migrate unrelated plugins to the new virtualized table as opportunistic cleanup.
- Do not remove existing import, export, add, edit, delete, search, or detail capabilities during migration.

## Protocol and Error Requirements

Every request/response operation must include a request ID. Responses must be ignored after cancellation, timeout, target change, or search change.

Errors use a consistent shape:

```ts
type StorageRequestError = {
  requestId: string;
  code:
    | 'TARGET_NOT_FOUND'
    | 'ENTRY_NOT_FOUND'
    | 'INVALID_CURSOR'
    | 'INVALID_REQUEST'
    | 'READ_FAILED'
    | 'WRITE_FAILED';
  message: string;
  resetPagination?: boolean;
};
```

Validate page limits, cursors, targets, keys, and payload types at the device boundary. Do not expose adapter error objects directly over the bridge.

## Migration Strategy

Implementation is additive until the new UI path is complete:

1. Add shared request/response infrastructure and preview types.
2. Add storage discovery while retaining snapshot messages.
3. Move the selector to discovery and stop eager all-storage snapshots.
4. Remove fallback polling without changing the visible table.
5. Add preview pagination and full-entry endpoints alongside snapshots.
6. Move import/export off UI snapshot ownership.
7. Add TanStack Query and the shared virtualized table without changing existing consumers.
8. Switch the storage panel to bounded previews and on-demand full values.
9. Replace value-carrying events with invalidations.
10. Remove the legacy snapshot protocol and dead code only after the new path is verified.

Every intermediate commit must typecheck, keep the existing UI usable, and preserve unrelated work.

## Performance Invariants

Tests and manual profiling must establish these invariants:

- Startup value reads do not scale with total entries across all storages.
- Selecting one storage does not read values from other storages.
- A page request reads values for at most the bounded page size.
- Search reads values only for the resulting page, never for all matches.
- DOM row count remains bounded while scrolling through a large result set.
- Retained preview pages never exceed configured `maxPages`.
- Closing a full-value interaction releases its value from query/component state.
- A storage without subscriptions performs zero background reads while idle.
- A native subscription event carries no value payload.
- Manual refresh discards prior pages and starts with exactly the first page.

## Verification Strategy

Each implementation task defines focused verification. The complete effort must also include:

- Unit tests for preview truncation, cursor behavior, request validation, cancellation, and reset behavior.
- Component tests for bounded row rendering, edge loading, loading states, errors, row actions, and Refresh.
- Device tests proving only page keys are read and no polling occurs without subscriptions.
- Stress fixtures with many storages, many keys, slow async reads, and very large values.
- Manual playground checks for scroll stability, search reset, refresh reset, mutations, import/export, subscription invalidation, and no-subscription behavior.
- Package-level typecheck, lint, tests, and build for every affected package.
- A version plan for behavior changes to publishable packages.

## Topologically Ordered Tasks

The executable task specifications live in `docs/workspace/tasks/`:

1. `01-plugin-request-client.md`
2. `02-entry-preview-model.md`
3. `03-storage-discovery-device.md`
4. `04-storage-discovery-ui.md`
5. `05-remove-fallback-polling.md`
6. `06-entry-preview-pagination-device.md`
7. `07-full-entry-request.md`
8. `08-device-owned-export.md`
9. `09-device-owned-import-preview.md`
10. `10-storage-infinite-query.md`
11. `11-shared-virtualized-table.md`
12. `12-panel-query-virtualization-cutover.md`
13. `13-invalidation-events.md`
14. `14-large-value-interactions.md`
15. `15-scalable-storage-selector.md`
16. `16-remove-legacy-snapshots.md`
17. `17-agent-tool-hardening.md`
18. `18-stress-verification-and-release-plan.md`

Each task is one focused commit. The worker loop is defined in `docs/workspace/loop.md`.
