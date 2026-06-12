# Component Labels

## Summary

Add agent-friendly labels such as `@c1`, `@c2`, and `@c3` to React node summaries, and allow those labels anywhere a React tool currently accepts `nodeId`.

This ports one of the best usability features from `agent-react-devtools`: agents can inspect by label after reading a tree, without copying long raw numeric React IDs.

## PR Recommendation

Implement in the same PR as:

- Get tree
- Get component
- Host filtering

Reason: labels are most valuable when `getTree` emits them and `getComponent` accepts them. Adding labels alone would not improve the workflow much.

## Current Rozenite Behavior

Rozenite exposes raw numeric React DevTools node IDs:

- `ReactNodeSummary.nodeId`
- `getNode({ nodeId })`
- `getChildren({ nodeId })`
- `getProps({ nodeId })`
- `getState({ nodeId })`
- `getHooks({ nodeId })`
- `searchNodes({ query })`

The relevant files are:

- `packages/middleware/src/agent/runtime/react/types.ts`
- `packages/middleware/src/agent/runtime/react/store.ts`
- `packages/middleware/src/agent/local-domains.ts`

## Proposed Data Model

Add `label` to node summaries:

```ts
type ReactNodeSummary = {
  nodeId: number;
  label: string;
  displayName: string;
  elementType: string;
  key?: string;
  childCount: number;
  parentId?: number;
  parentLabel?: string;
};
```

Add label maps to `DeviceReactTreeState`:

```ts
type DeviceReactTreeState = {
  labelByNodeId: Map<number, string>;
  nodeIdByLabel: Map<string, number>;
};
```

Labels should be regenerated whenever a tree sync replaces topology.

## Label Stability

Use deterministic traversal order:

1. Sort roots by numeric ID.
2. Traverse each root in pre-order.
3. Preserve each node's `childIds` order from React DevTools operations.
4. Assign labels incrementally: `@c1`, `@c2`, etc.

Labels are session-local and tree-snapshot-local. They may change after reloads or large tree changes. That is acceptable as long as every response includes the current label.

## Label Resolution

Add helper:

```ts
const resolveNodeId = (
  state: DeviceReactTreeState,
  value: unknown,
  fieldName: string,
): number => { ... };
```

Rules:

- If `value` is an integer, use it as a node ID.
- If `value` is a string matching `/^@c\d+$/`, resolve from `nodeIdByLabel`.
- If `value` is a numeric string, optionally accept it for convenience.
- Throw clear errors:
  - `"nodeId" must be an integer or component label like "@c12"`
  - `Component label "@c12" no longer exists in the current React tree.`
  - `Node "123" no longer exists in the current React tree.`

## Tool Schema Changes

Existing tools can remain backward compatible by adding an optional `id` field while keeping `nodeId`.

Recommended pattern:

```ts
type ReactNodeIdentifier = number | string;

type ReactGetNodeRequest = {
  nodeId?: number;
  id?: ReactNodeIdentifier;
};
```

Resolution priority:

1. `id`
2. `nodeId`

For minimal churn, existing tool descriptions can say `nodeId` accepts labels after broadening schema to `oneOf: [{ type: 'integer' }, { type: 'string' }]`.

## Implementation Steps

1. Extend React node types with `label` and optional `parentLabel`.
2. Add label maps to device state.
3. In `syncTree`, after `rootIds` and `nodesById` are replaced, rebuild labels.
4. Update `ensureNodeSummary` to include `label` and `parentLabel`.
5. Replace `getNodeId` usage with `resolveNodeId` in:
   - `getNode`
   - `getChildren`
   - `getProps`
   - `getState`
   - `getHooks`
   - `getRenderData` if component/fiber IDs become accepted there later
   - new `getTree`
   - new `getComponent`
6. Update tool schemas in `createReactDomainService`.
7. Update CLI skill docs with examples using labels.
8. Mirror equivalent CLI runtime files if needed.

## Test Plan

Cover:

- Labels are assigned after tree sync.
- Labels are deterministic for the same tree.
- `searchNodes` returns labels.
- `getNode({ id: "@c2" })` returns the expected node.
- Existing `getNode({ nodeId: 123 })` still works.
- Stale labels produce a helpful error.
- Labels rebuild after a new tree sync.

## Acceptance Criteria

- Every React node summary includes `label`.
- Existing numeric `nodeId` workflows remain valid.
- Agents can use `@cN` labels in all inspection/tree tools.
- Tool descriptions explain that labels are session-local.

