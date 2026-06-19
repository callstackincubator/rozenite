# Get Component

## Summary

Add a `getComponent` tool that returns a node summary plus props, state, and hooks in one request.

This ports the `agent-react-devtools get component @cN` workflow. It should use the existing React DevTools `inspectElement` request path that Rozenite already uses for `getProps`, `getState`, and `getHooks`.

## PR Recommendation

Implement in the same PR as:

- Component labels
- Get tree
- Host filtering

Reason: the desired workflow is `getTree` -> `getComponent({ id: "@c7" })`. Labels and tree output make this tool much easier to use.

## Current Rozenite Behavior

Rozenite currently provides separate paginated tools:

- `getProps`
- `getState`
- `getHooks`

They already request full inspection data through:

- `requestInspectableSnapshot` in `packages/middleware/src/agent/runtime/react/store.ts`
- `inspectElement` messages with `forceFullData: true`

## Proposed Tool

Tool name: `getComponent`

Input:

```ts
type ReactGetComponentRequest = {
  id?: number | string;
  nodeId?: number;
  include?: Array<'props' | 'state' | 'hooks'>;
  valueDepth?: number;
};
```

Output:

```ts
type ReactGetComponentResult = {
  node: ReactNodeSummary & {
    childIds: number[];
    childLabels: string[];
    rendererId?: number;
    errors?: number;
    warnings?: number;
  };
  props?: unknown;
  state?: unknown;
  hooks?: unknown;
  partial?: boolean;
  unavailable?: Array<'props' | 'state' | 'hooks'>;
};
```

`include` defaults to all three sections.

## Serialization

Use the existing `createSerializableSnapshot` helper for props, state, and hooks.

Default depth should be high enough for useful inspection but bounded. Recommended:

- `props`: depth 4
- `state`: depth 4
- `hooks`: depth 6

If implementing a single `valueDepth`, clamp it to a safe maximum, for example 8.

## Behavior

- Accept `id` as numeric node ID or label.
- Accept legacy `nodeId`.
- Request full inspection if there is no cached snapshot.
- Return whichever sections React DevTools provides.
- If no sections are returned, throw the same kind of helpful error as existing `getProps`.
- Include node summary even when some sections are unavailable.
- Mark `partial: true` if at least one requested section is unavailable.

## Implementation Steps

1. Add request/result types to `packages/middleware/src/agent/runtime/react/types.ts`.
2. Add `GET_COMPONENT_TOOL_NAME = 'getComponent'` in `store.ts`.
3. Add helper to fetch an inspected record:
   - Reuse the existing `requestInspectableSnapshot`.
   - Avoid duplicating the inspection request logic used by `getInspectableEntries`.
4. Add `getComponent(deviceId, rawRequest)` to `createReactTreeStore`.
5. Resolve node through the shared label-aware ID resolver.
6. Build node details:
   - `ensureNodeSummary(node)`
   - `childIds`
   - `childLabels`
   - `rendererId`
   - future `errors` and `warnings` if available
7. Serialize included sections.
8. Register the tool in `createReactDomainService`.
9. Add `getComponent` to `STATIC_DOMAIN_TOOL_NAMES.react` in `packages/agent-sdk/src/constants.ts`.
10. Update CLI skill docs.
11. Mirror CLI runtime files if needed.

## Tool Schema

Recommended JSON schema:

```ts
{
  type: 'object',
  properties: {
    id: {
      oneOf: [{ type: 'integer' }, { type: 'string' }],
      description: 'React node ID or component label, for example 123 or "@c7".'
    },
    nodeId: {
      type: 'integer',
      description: 'Deprecated alias for numeric React node ID.'
    },
    include: {
      type: 'array',
      items: { type: 'string', enum: ['props', 'state', 'hooks'] },
      description: 'Sections to include. Defaults to all sections.'
    },
    valueDepth: {
      type: 'integer',
      description: 'Max nested serialization depth. Default 4, max 8.'
    }
  }
}
```

Require either `id` or `nodeId` in runtime validation. JSON Schema draft support for `anyOf` may be available, but runtime validation should still enforce this.

## Test Plan

Cover:

- Numeric node ID returns node plus props/state/hooks.
- Label ID returns the same component.
- `include: ['props']` returns only props.
- Missing inspected data throws a helpful error.
- Partial inspected data returns `partial: true`.
- Serialization truncates deep objects and handles functions, symbols, undefined, circular references.
- Existing `getProps/getState/getHooks` behavior remains unchanged.

## Acceptance Criteria

- Agents can inspect a component with one call after finding it in `getTree` or `searchNodes`.
- Existing paginated inspection tools remain available for large props/state/hooks.
- The output is bounded and JSON-safe.

