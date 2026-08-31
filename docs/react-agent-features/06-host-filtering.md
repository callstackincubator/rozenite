# Host Filtering

> **Status: implemented as opt-in `noHost`, but the premise below is wrong.**
>
> This document assumes a React Native tree is dominated by host components. It is
> not — they never reach Rozenite at all. `getDefaultComponentFilters()` in
> `react-devtools-core` hides host components **at the backend**, and Rozenite
> never sends `updateComponentFilters` to override it, so host fibers are filtered
> before they reach the wire. Confirmed on a live session: `getTree` reports `View`
> as `elementType: "function"` and returns no host fibers at all.
>
> What shipped: `noHost: true` on `getTree`, `getChildren` and `searchNodes`,
> defaulting to **off**, with the promotion and visible-parent semantics described
> below. It is a safety net for the one case where host fibers do arrive — a
> DevTools frontend on the same backend having re-enabled host components — not a
> token saving. Do not make it default-on: it would change existing tool behaviour
> and buy nothing.
>
> Genuinely exposing host components would mean sending `updateComponentFilters`,
> which makes the backend re-send the whole tree and invalidates node IDs and
> labels mid-session. That is a separate, statefuller change and is not
> implemented.


## Summary

Add an option to hide low-signal host nodes from tree-style React outputs.

React Native trees contain many host components. Filtering them makes component exploration much easier for agents while preserving significant host nodes when they carry useful identity.

## PR Recommendation

Implement in the same PR as:

- Get tree
- Component labels
- Get component

Reason: host filtering is primarily a `getTree` feature and affects label/tree traversal semantics. It should be designed together with those APIs.

## Current Rozenite Behavior

Rozenite returns host nodes from `searchNodes`, `getChildren`, and `getNode` because they reflect the React DevTools tree directly.

There is no current component-only tree view.

## Proposed API

Add `noHost?: boolean` to `getTree`.

Optional later additions:

- `searchNodes({ includeHost?: boolean })`
- `getChildren({ noHost?: boolean })`

For the first implementation, keep host filtering scoped to `getTree` to avoid surprising existing tool behavior.

## Filtering Rule

When `noHost` is true:

- Hide host nodes by default.
- Keep host nodes that are significant:
  - node has a `key`
  - display name includes `-`, which suggests a custom element
  - node has non-zero errors or warnings
  - node is the explicitly requested root

When a host node is hidden, promote its children to the nearest visible ancestor in the returned tree.

## Output Semantics

For filtered tree output:

- `parentId` and `parentLabel` should refer to the visible parent, not necessarily the real React parent.
- `childIds` and `childLabels` should list visible children.
- Include `realParentId` only if useful. Prefer omitting it for v1 to keep output compact.
- `depth` should be visual depth in the filtered tree.
- Labels should remain labels for real nodes. Do not create virtual nodes.

## Implementation Steps

1. Implement `isSignificantHost(node)` in `store.ts` or a small helper module.
2. In `getTree` traversal, add two concepts:
   - real traversal parent from the React tree
   - visible parent for filtered output
3. If a node is hidden:
   - do not emit it
   - traverse children with the same visible parent and same visual depth
4. If a node is visible:
   - emit it
   - traverse children with this node as visible parent and `depth + 1`
5. Patch each emitted node's visible child list after traversal, or build visible children as traversal proceeds.
6. Preserve cycle protection with a visited set.

## Pseudocode

```ts
const walk = (nodeId, visualParentId, depth) => {
  const node = state.nodesById.get(nodeId);
  if (!node || visited.has(nodeId)) return;
  visited.add(nodeId);

  const hidden =
    noHost &&
    node.elementType === 'host' &&
    !isSignificantHost(node) &&
    nodeId !== requestedRootId;

  if (hidden) {
    for (const childId of node.childIds) {
      walk(childId, visualParentId, depth);
    }
    return;
  }

  emit(node, visualParentId, depth);

  for (const childId of node.childIds) {
    walk(childId, nodeId, depth + 1);
  }
};
```

## Test Plan

Cover:

- Plain host nodes are hidden when `noHost: true`.
- Children of hidden hosts are promoted.
- Keyed host nodes remain visible.
- Custom element names remain visible.
- Host nodes with errors/warnings remain visible after error support lands.
- Explicit host root remains visible.
- Depth is visual depth, not raw React depth.
- Labels still resolve to real nodes.

## Acceptance Criteria

- `getTree({ noHost: true })` produces a compact component-focused tree.
- Existing tools remain unfiltered unless explicitly extended.
- The filtered tree is still usable with `getComponent` because labels/node IDs refer to real nodes.

