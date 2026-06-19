# Errors And Warnings

## Summary

Parse React DevTools `TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS` operations and expose error/warning counts on nodes, plus a focused tool to list affected components.

This ports the `agent-react-devtools errors` behavior.

## PR Recommendation

Implement as a separate PR.

Reason: this touches the operations parser and node model, but does not need the tree/label/component API to be useful. It is small and reviewable on its own.

## Current Rozenite Behavior

Rozenite defines the opcode but currently skips it:

- `TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS = 5`
- `parseTreeOperations` advances by four fields but does not return the counts.

Relevant files:

- `packages/middleware/src/agent/runtime/react/operations-parser.ts`
- `packages/middleware/src/agent/runtime/react/component-tree-store.ts`
- `packages/middleware/src/agent/runtime/react/store.ts`
- `packages/middleware/src/agent/runtime/react/types.ts`
- `packages/middleware/src/agent/local-domains.ts`

## Protocol Shape

React DevTools operation:

```ts
[
  TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS,
  nodeId,
  errorCount,
  warningCount
]
```

## Proposed Model Changes

Extend parsed operations:

```ts
type ParsedTreeOperations = {
  errorWarningUpdates: Array<{
    nodeId: number;
    errors: number;
    warnings: number;
  }>;
};
```

Extend node records:

```ts
type TreeNodeRecord = {
  errors?: number;
  warnings?: number;
};

interface ReactNodeSummary {
  errors?: number;
  warnings?: number;
}
```

Omit fields when counts are zero to keep output compact.

## Proposed Tool

Tool name: `getErrors`

Input:

```ts
type ReactGetErrorsRequest = {
  root?: number | string;
  limit?: number;
  cursor?: string;
};
```

Output:

```ts
type ReactGetErrorsResult = {
  items: Array<ReactNodeSummary & {
    errors: number;
    warnings: number;
  }>;
  totalCount: number;
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
};
```

Alternative tool name: `errors`, matching `agent-react-devtools`. Prefer `getErrors` for Rozenite's existing verb style.

## Behavior

- Update node counts whenever operation type 5 arrives.
- If a node is removed, its counts disappear with it.
- `searchNodes`, `getNode`, `getChildren`, `getTree`, and `getComponent` should include non-zero counts once available.
- `getErrors` returns nodes where `errors > 0 || warnings > 0`.
- Sort by descending `errors`, then descending `warnings`, then display name or tree order.
- Support root scoping if label/tree support exists. If this ships before labels, support numeric `rootId` only or omit scoping for v1.

## Implementation Steps

1. Update `ParsedTreeOperations` in `operations-parser.ts`.
2. Parse operation type 5 instead of skipping it.
3. Add error/warning fields to internal tree records.
4. Apply updates in `component-tree-store.ts`.
5. Include non-zero counts in summary conversion helpers.
6. Add `getErrors` to `createReactTreeStore`.
7. Register `getErrors` in `createReactDomainService`.
8. Add `getErrors` to `STATIC_DOMAIN_TOOL_NAMES.react`.
9. Update CLI skill docs.
10. Mirror CLI runtime changes if needed.

## Test Plan

Cover parser:

- Parses a valid error/warning update.
- Ignores malformed counts without throwing.
- Keeps parsing following operations after an update.

Cover store:

- Node summary includes non-zero counts.
- Counts update from non-zero back to zero and fields are omitted.
- Removed nodes no longer appear in `getErrors`.
- `getErrors` paginates.

## Acceptance Criteria

- React DevTools error/warning counts are visible to agents.
- A dedicated `getErrors` tool lists only affected components.
- Existing tree parsing behavior remains unchanged for all other operation types.

