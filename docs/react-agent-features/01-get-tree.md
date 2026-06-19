# Get Tree

## Summary

Add a `getTree` tool to the built-in `react` agent domain. It should return a compact component hierarchy for the current React tree, optionally scoped by root/subtree and limited by depth.

This ports the most useful part of `agent-react-devtools get tree`: one command that lets an agent understand the app structure before choosing a component to inspect.

## PR Recommendation

Implement in the same PR as:

- Component labels
- Get component
- Host filtering

Reason: `getTree` should expose stable labels, accept labels as roots, and share traversal/filtering logic with `getComponent`.

## Current Rozenite Behavior

Rozenite currently exposes:

- `searchNodes`
- `getNode`
- `getChildren`

These are accurate but require several calls to reconstruct the tree. The relevant implementation is in:

- `packages/middleware/src/agent/runtime/react/store.ts`
- `packages/middleware/src/agent/runtime/react/types.ts`
- `packages/middleware/src/agent/local-domains.ts`

## Proposed Tool

Tool name: `getTree`

Input:

```ts
type ReactGetTreeRequest = {
  root?: number | string;
  depth?: number;
  noHost?: boolean;
  limit?: number;
  cursor?: string;
};
```

Output:

```ts
type ReactTreeNode = {
  nodeId: number;
  label: string;
  displayName: string;
  elementType: string;
  key?: string;
  parentId?: number;
  parentLabel?: string;
  childIds: number[];
  childLabels: string[];
  childCount: number;
  depth: number;
  errors?: number;
  warnings?: number;
};

type ReactGetTreeResult = {
  roots: Array<{ nodeId: number; label: string }>;
  items: ReactTreeNode[];
  totalCount: number;
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
};
```

Use `items` instead of `nodes` to match existing paginated Rozenite tool style.

## Behavior

- If `root` is omitted, traverse all current React roots.
- If `root` is provided, accept a numeric node ID or a label such as `@c12`.
- `depth` limits descendants relative to the selected traversal root. `0` means only the root node(s).
- `noHost` filters out host nodes that are not significant. See `06-host-filtering.md`.
- Results should be breadth-first or pre-order depth-first, but must be deterministic. Prefer pre-order because it reads like a component tree.
- Include `totalCount` before pagination so agents know whether the response is partial.
- Preserve existing cursor conventions using base64url cursor payloads with `tool: "getTree"` and a filters hash.

## Implementation Steps

1. Add request/result types in `packages/middleware/src/agent/runtime/react/types.ts`.
2. Add constants in `store.ts`:
   - `GET_TREE_TOOL_NAME = 'getTree'`
   - default/max limits can reuse existing search limits unless a tree-specific default is desired.
3. Add an ID resolver helper shared by future label support:
   - `resolveNodeId(state, value, fieldName)`
   - Accepts `number` and label `string`.
   - Initially numeric only if labels are not in the same patch, but the preferred PR includes labels.
4. Add traversal helper:
   - Starts from resolved root or `state.rootIds`.
   - Computes `depth`.
   - Avoids cycles via a visited set.
   - Skips missing child IDs defensively.
5. Convert internal `ReactNodeRecord` to `ReactTreeNode`.
6. Add pagination:
   - Include `root`, `depth`, and `noHost` in `filtersHash`.
   - Reject mismatched cursors with the same error style as existing tools.
7. Expose `getTree` from `createReactTreeStore`.
8. Register the tool in `createReactDomainService` in `packages/middleware/src/agent/local-domains.ts`.
9. Add `getTree` to `STATIC_DOMAIN_TOOL_NAMES.react` in `packages/agent-sdk/src/constants.ts`.
10. Update `packages/cli/skills/rozenite-agent/domains/react.md`.
11. If required by the repository structure, mirror runtime changes under `packages/cli/src/commands/agent/runtime/react/*`.

## Test Plan

Add focused tests for the store-level behavior. If there is no existing test file for React store, create one under:

`packages/middleware/src/agent/runtime/react/__tests__/store.test.ts`

Cover:

- Returns all roots and descendants in deterministic order.
- `depth: 0`, `depth: 1`, and omitted depth.
- Scoped root by numeric ID.
- Scoped root by label after label support lands.
- Pagination returns `nextCursor` and rejects mismatched cursor context.
- Missing/stale root throws a clear error.
- `noHost` behavior if implemented in the same PR.

Also add a domain registration test if local-domain tests are already asserting built-in tools.

## Acceptance Criteria

- `rozenite agent react call --tool getTree --args '{}' --session <id>` returns a compact tree.
- Existing React tools keep their current schemas and behavior.
- New tool appears in `rozenite agent react tools`.
- SDK domain resolution recognizes `getTree`.

