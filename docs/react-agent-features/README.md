# React Agent Feature Port Plan

This folder contains implementation briefs for porting the useful agent-facing behavior from `callstackincubator/agent-react-devtools` into Rozenite's built-in `react` agent domain.

The goal is not to copy its WebSocket transport. Rozenite already receives React DevTools protocol messages through the React Native DevTools/Fusebox integration and already parses tree, inspection, and profiling data. The goal is to improve the Rozenite agent API so it is easier for humans and LLM agents to inspect a running React Native app.

## Source Context

- External reference clone: `/Users/szymon.chmal/Projects/agent-react-devtools`
- Rozenite React DevTools bridge: `packages/middleware/src/agent/runtime/react/react-devtools-bridge.ts`
- Rozenite React store: `packages/middleware/src/agent/runtime/react/store.ts`
- Rozenite React types: `packages/middleware/src/agent/runtime/react/types.ts`
- Rozenite React domain registration: `packages/middleware/src/agent/local-domains.ts`
- Static SDK domain tool list: `packages/agent-sdk/src/constants.ts`
- Current CLI skill reference: `packages/cli/skills/rozenite-agent/domains/react.md`
- Mirrored CLI runtime copy: `packages/cli/src/commands/agent/runtime/react/*`

When implementing, treat `packages/middleware` as the canonical runtime location. If the CLI copy is still intentionally maintained, mirror equivalent runtime/type changes there after changing middleware.

## Recommended PR Slicing

### PR 1: Core Agent Ergonomics

Implement these together because they share ID resolution, node summaries, label generation, and tree traversal:

- [Component Labels](./02-component-labels.md)
- [Get Tree](./01-get-tree.md)
- [Get Component](./03-get-component.md)
- [Host Filtering](./06-host-filtering.md)

This PR should add labels and then expose them through `getTree`, `getComponent`, `searchNodes`, `getNode`, and `getChildren`. Host filtering can be implemented as a `getTree` option in the same traversal code.

### PR 2: Error And Warning Tracking

- [Errors And Warnings](./04-errors-warnings.md)

This touches operation parsing and tree node state, but does not need to ship with the label/tree/component API.

### PR 3: Profiling Convenience Tools

- [Profile Convenience Tools](./05-profile-convenience-tools.md)

This builds on Rozenite's existing profiling store and should stay separate from tree inspection changes to keep review focused.

## Compatibility Rules

- Keep existing tools working: `searchNodes`, `getNode`, `getChildren`, `getProps`, `getState`, `getHooks`, `startProfiling`, `isProfilingStarted`, `stopProfiling`, `getRenderData`.
- Add new tools instead of replacing current ones.
- Keep raw numeric `nodeId` support even after adding labels.
- Prefer additive result fields such as `label`, `errors`, and `warnings`.
- Keep cursor pagination stable for existing tools.
- Update SDK constants and CLI skill docs whenever public tool names change.

## Verification

At minimum, each PR should run:

```sh
pnpm --filter @rozenite/middleware test
pnpm --filter @rozenite/middleware typecheck
pnpm --filter @rozenite/agent-sdk typecheck
```

If mirrored CLI runtime files are changed:

```sh
pnpm --filter rozenite typecheck
```

