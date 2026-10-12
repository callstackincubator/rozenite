---
name: react
description: Search and traverse the React component tree, read props/state/hooks, list components with logged errors or warnings, and profile renders to find what is slow or re-rendering.
domain: react
integrations: react-native
---

Search and traverse the React component tree, read props, state, and hooks for any
node, list components React logged errors or warnings against, and profile renders
to find which components are slow or re-rendering too often.

## Tools

Inspect:

```sh
npx rozenite agent react searchNodes --query Button
npx rozenite agent react searchNodes --query item --match name-or-key --rootId @c3
npx rozenite agent react getTree
npx rozenite agent react getTree --depth 2 --root @c3
npx rozenite agent react getComponent --id @c12
npx rozenite agent react getComponent --id @c12 --include props --maxValueLength 120
npx rozenite agent react getNode --id @c12
npx rozenite agent react getChildren --id @c12
npx rozenite agent react getProps --id @c12
npx rozenite agent react getState --id @c12 --maxValueLength 120
npx rozenite agent react getHooks --id @c12
npx rozenite agent react getHooks --id @c12 --args '{"path":[0,"subHooks",1]}'
npx rozenite agent react getErrors
npx rozenite agent react getErrors --root @c3
```

Profile:

```sh
npx rozenite agent react startProfiling
npx rozenite agent react startProfiling --shouldRestart
npx rozenite agent react isProfilingStarted
npx rozenite agent react stopProfiling --waitForDataMs 3000 --slowRenderThresholdMs 16
npx rozenite agent react getComponentRenders
npx rozenite agent react getComponentRenders --sort render-count-desc
npx rozenite agent react getComponentRenders --id @c12
npx rozenite agent react getProfileTimeline --sort duration-desc
npx rozenite agent react getRenderData --rootId 1 --commitIndex 0
```

## Identifying nodes

Every node has a `label` such as `@c12`. Any argument that takes a node
(`--id`, `--nodeId`, `--root`, `--rootId` on `searchNodes`, `--fiberId`) accepts
either the label or the numeric node ID, so the label is all a row needs to
carry. Labels can change when the tree changes; if a label is reported as no
longer existing, read the tree again.

The profiling tools' `--rootId` is a React root ID: take it from a profiling
row's `rootId` column or from the `roots` that `getTree` prints with its page.

## Flow

Search and inspect:
`getTree` / `searchNodes` -> `getComponent` / `getNode` / `getChildren` -> `getProps` / `getState` / `getHooks`.

Profile:
`startProfiling` -> reproduce interaction -> `stopProfiling` -> `getComponentRenders`.

`getComponentRenders` aggregates every commit into one row per component, so
"what was slow" and "what re-rendered too often" are a single call rather than a
`getRenderData` page per commit. Sort by `total-duration-desc` (default),
`avg-duration-desc`, `max-duration-desc`, `render-count-desc`, or `name-asc`.
Pass `--id` for one component's report. Each row's `slowestCommitIndex`
points at the commit to drill into.

Drill down:
`getProfileTimeline` lists every commit with its duration, and `getRenderData`
opens one of them fiber by fiber.

All durations and timestamps are in milliseconds with at most three decimals.

## Default columns

Every listing returns a trimmed default projection. Pass `--fields` to pick
columns, or `--fields all` for every column the tool declares.

- `getTree`: `label`, `displayName`, `childCount`, `depth`. Also available:
  `nodeId`, `elementType`, `key`, `parentId`, `parentLabel`, `childIds`,
  `errorCount`, `warningCount`.
- `getChildren`: `label`, `displayName`, `childCount`. Also available:
  `nodeId`, `elementType`, `key`, `parentId`, `parentLabel`, `errorCount`,
  `warningCount`.
- `searchNodes`: `label`, `displayName`, `childCount`, `parentLabel`. Also
  available: `nodeId`, `elementType`, `key`, `parentId`, `errorCount`,
  `warningCount`.
- `getErrors`: `label`, `displayName`, `errorCount`, `warningCount`.
- `getComponentRenders`: `fiberId`, `label`, `displayName`, `renderCount`,
  `totalDurationMs`, `maxDurationMs`, `changeTypeHints`. Also available:
  `rootId`, `avgDurationMs`, `totalSelfDurationMs`, `slowRenderCount`,
  `slowestCommitIndex`, `changedKeys`.
- `getProfileTimeline`: `rootId`, `commitIndex`, `durationMs`,
  `renderedFiberCount`, `isSlow`. Add `effectDurationMs` and
  `passiveEffectDurationMs` to see commits that render fast but commit slowly,
  `priorityLevel` and `updaterCount` for how an update was scheduled and how
  many fibers scheduled it, and `hasChangeDescriptions` to tell whether
  `getRenderData` can explain that commit.
- `getRenderData`: `fiberId`, `displayName`, `actualDurationMs`,
  `selfDurationMs`, `isSlow`. Add `changeTypeHints` and `changedKeys` for the
  exact changed prop, state, and context key names behind a re-render, which
  attributes it without a follow-up `getComponent` call per fiber.
- `getProps`, `getState`, `getHooks`: always both of their only two fields,
  `name` and `value`.

To find components with logged errors or warnings, use `getErrors` rather than
scanning tree columns.

## Host filtering

React DevTools hides plain host components (the native views React renders
into, such as `RCTView`) at the backend by default, so they rarely reach this
tree. If a DevTools frontend on the same backend has turned them back on, pass
`--noHost` to `getTree`, `getChildren`, or `searchNodes` to hide them again.
Host nodes are kept either way when they have a `key`, a hyphenated custom
element name, or logged errors or warnings.

With `--noHost`, `parentId`, `childIds`, `childCount`, and `depth` describe the
filtered tree: a hidden host's children are promoted to its nearest visible
ancestor. Following `childIds` therefore always lands on a node the same call
would return. Labels and node IDs always refer to real React nodes, so
`getComponent` works on anything either view returns.

## Value truncation

`getComponent`, `getProps`, `getState`, and `getHooks` truncate serialized
strings longer than `--maxValueLength` (default 512) and mark the cut with
`[+N chars]`. `--valueDepth` bounds nesting on `getComponent`; this bounds
width, so one base64 image or serialized blob cannot dominate a response.

## Platform availability

React Native only. Lynx has no React DevTools backend, so this domain is
reported `unsupported` on a Lynx session. There is no substitute domain:
read component structure from source, and use plugin domains for runtime
state.
