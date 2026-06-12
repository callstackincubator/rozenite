# Profile Convenience Tools

## Summary

Add high-level profiling tools that summarize the profiling data Rozenite already captures.

This ports the useful agent-facing commands from `agent-react-devtools`:

- slowest renders
- most re-rendered components
- profiling timeline
- component-specific profile report

## PR Recommendation

Implement as a separate PR.

Reason: Rozenite already has a robust profiling core. These tools are derived views over captured data and should be reviewed separately from tree inspection changes.

## Current Rozenite Behavior

Existing tools:

- `startProfiling`
- `isProfilingStarted`
- `stopProfiling`
- `getRenderData`

Current profiling data is normalized in:

- `packages/middleware/src/agent/runtime/react/profiling-store.ts`
- `packages/middleware/src/agent/runtime/react/store.ts`
- `packages/middleware/src/agent/runtime/react/react-devtools-bridge.ts`

Rozenite already waits for a confirmed stopped profiling status before requesting `getProfilingData`; preserve that behavior.

## Proposed Tools

### `getProfileTimeline`

Input:

```ts
type ReactGetProfileTimelineRequest = {
  rootId?: number;
  sort?: 'timeline' | 'duration-desc';
  limit?: number;
  cursor?: string;
};
```

Output:

```ts
type ReactGetProfileTimelineResult = {
  items: Array<{
    rootId: number;
    commitIndex: number;
    durationMs: number;
    timestampMs: number;
    renderedFiberCount: number;
  }>;
  totalCount: number;
  page: Page;
};
```

### `getSlowRenders`

Input:

```ts
type ReactGetSlowRendersRequest = {
  thresholdMs?: number;
  rootId?: number;
  limit?: number;
  cursor?: string;
};
```

Output:

```ts
type ReactGetSlowRendersResult = {
  items: Array<{
    rootId: number;
    commitIndex: number;
    fiberId: number;
    label?: string;
    displayName: string;
    actualDurationMs: number;
    selfDurationMs: number;
    changeTypeHints?: string[];
  }>;
  totalCount: number;
  thresholdMs: number;
  page: Page;
};
```

### `getRerenders`

Input:

```ts
type ReactGetRerendersRequest = {
  rootId?: number;
  limit?: number;
  cursor?: string;
};
```

Output:

```ts
type ReactGetRerendersResult = {
  items: Array<{
    fiberId: number;
    label?: string;
    displayName: string;
    renderCount: number;
    totalDurationMs: number;
    averageDurationMs: number;
    maxDurationMs: number;
  }>;
  totalCount: number;
  page: Page;
};
```

### `getProfileReport`

Input:

```ts
type ReactGetProfileReportRequest = {
  id?: number | string;
  fiberId?: number;
};
```

Output:

```ts
type ReactGetProfileReportResult = {
  fiberId: number;
  label?: string;
  displayName: string;
  renderCount: number;
  totalDurationMs: number;
  averageDurationMs: number;
  maxDurationMs: number;
  causes: Array<'mount' | 'props' | 'state' | 'context' | 'hooks' | 'parent'>;
  changedKeys: {
    props: string[];
    state: string[];
    hooks: number[];
  };
  commits: Array<{
    rootId: number;
    commitIndex: number;
    actualDurationMs: number;
    selfDurationMs: number;
    changeTypeHints?: string[];
  }>;
};
```

## Behavior

- All tools require profiling data. If none exists, throw: `No React profiling data available. Run startProfiling and stopProfiling first.`
- Derived component names should use current tree names when available, and fall back to `Fiber <id>`.
- If label support exists, include labels.
- If a component unmounted after profiling, still return its fiber ID and fallback display name.
- Keep `getRenderData` as the detailed per-commit page tool.

## Implementation Steps

1. Add result/request types in `types.ts`.
2. Add helper functions in `store.ts` or a new `profile-reports.ts` module:
   - iterate all roots and commits from `bridge.getProfilingDataSnapshot()`
   - normalize duration entries from `Map<number, number>`
   - derive change hints using existing `toChangeTypeHints`
3. Add store methods:
   - `getProfileTimeline`
   - `getSlowRenders`
   - `getRerenders`
   - `getProfileReport`
4. Add cursor pagination for list tools.
5. Register tools in `createReactDomainService`.
6. Add tool names to `STATIC_DOMAIN_TOOL_NAMES.react`.
7. Update CLI skill docs with a recommended workflow.
8. Mirror CLI runtime files if needed.

## Test Plan

Cover:

- Timeline over multiple roots and commits.
- Duration sorting.
- Slow render threshold.
- Rerender aggregation by fiber ID.
- Profile report with props/state/hooks/context hints.
- Missing profiling data error.
- Pagination cursor mismatch handling.
- Labels included when label support exists.

## Acceptance Criteria

- Agents can answer "what was slow?" without manually paging every commit.
- Existing profiling start/stop behavior remains unchanged.
- `getRenderData` still works for deep per-commit inspection.

