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

- `searchNodes` -> `{"query":"<query>"}` | `{"query":"<query>","cursor":"<cursor>"}` | `{"query":"<query>","limit":20}`
- `getTree` -> `{}` | `{"depth":2}` | `{"root":123}` | `{"cursor":"<cursor>"}`
- `getComponent` -> `{"id":123}` | `{"nodeId":123}` | `{"id":123,"include":["props"]}` | `{"id":123,"maxValueLength":120}`
- `getNode` -> `{"nodeId":123}`
- `getChildren` -> `{"nodeId":123}` | `{"nodeId":123,"cursor":"<cursor>"}` | `{"nodeId":123,"limit":20}`
- `getProps` -> `{"nodeId":123}` | `{"nodeId":123,"maxValueLength":120}` | `{"nodeId":123,"cursor":"<cursor>"}`
- `getState` -> `{"nodeId":123}` | `{"nodeId":123,"maxValueLength":120}` | `{"nodeId":123,"cursor":"<cursor>"}`
- `getHooks` -> `{"nodeId":123}` | `{"nodeId":123,"path":[0,"subHooks",1]}` | `{"nodeId":123,"limit":20}`
- `getErrors` -> `{}` | `{"root":123}` | `{"cursor":"<cursor>"}`
- `startProfiling` -> `{}` | `{"shouldRestart":true}`
- `isProfilingStarted` -> `{}`
- `stopProfiling` -> `{}` | `{"waitForDataMs":3000}` | `{"slowRenderThresholdMs":16}`
- `getComponentRenders` -> `{}` | `{"sort":"render-count-desc"}` | `{"id":"@c12"}` | `{"rootId":1,"cursor":"<cursor>"}`
- `getProfileTimeline` -> `{}` | `{"sort":"duration-desc"}` | `{"rootId":1,"limit":20}`
- `getRenderData` -> `{"rootId":1,"commitIndex":0}` | `{"rootId":1,"commitIndex":0,"cursor":"<cursor>"}` | `{"rootId":1,"commitIndex":0,"limit":20}`

## Flow

Search and inspect:
`getTree` / `searchNodes` -> `getComponent` / `getNode` / `getChildren` -> `getProps` / `getState` / `getHooks`.

Profile:
`startProfiling` -> reproduce interaction -> `stopProfiling` -> `getComponentRenders`.

`getComponentRenders` aggregates every commit into one row per component, so
"what was slow" and "what re-rendered too often" are a single call rather than a
`getRenderData` page per commit. Sort by `total-duration-desc` (default),
`avg-duration-desc`, `max-duration-desc`, or `render-count-desc`. Pass
`id`/`fiberId` for one component's report. Each row's `slowestCommitIndex`
points at the commit to drill into.

Drill down:
`getProfileTimeline` lists every commit with its duration, and `getRenderData`
opens one of them fiber by fiber.

`getProfileTimeline` rows carry render duration and rendered-fiber count by
default. Add `--fields ...,effectDurationMs,passiveEffectDurationMs` to see
commits that render fast but commit slowly, `priorityLevel` and `updaterCount`
for how an update was scheduled and how many fibers scheduled it, and
`hasChangeDescriptions` to tell whether `getRenderData` can explain that commit.

`getRenderData` and `getComponentRenders` rows carry `displayName` and timing by
default. Add `--fields ...,changedKeys` for the exact changed prop, state, and
context key names behind `changeTypeHints`, which attributes a re-render without
a follow-up `getComponent` call per fiber.

## Host filtering

`getTree`, `getChildren`, and `searchNodes` hide plain host components by
default — the native views React renders into, such as `RCTView`, which dominate
a React Native tree and carry no component identity of their own. Host nodes are
kept when they have a `key`, a hyphenated custom element name, or logged errors
or warnings. Pass `includeHost: true` for the raw React tree.

In a filtered `getTree`, `parentId`, `childIds`, `childCount`, and `depth`
describe the filtered tree: a hidden host's children are promoted to its nearest
visible ancestor. Following `childIds` therefore always lands on a node the same
call would return. Labels and node IDs always refer to real React nodes, so
`getComponent` works on anything either view returns.

## Value truncation

`getComponent`, `getProps`, `getState`, and `getHooks` truncate serialized
strings longer than `maxValueLength` (default 512) and mark the cut with
`[+N chars]`. `valueDepth` bounds nesting; this bounds width, so one base64
image or serialized blob cannot dominate a response.

CLI discovery listings and paginated React calls (`getTree`, `searchNodes`,
`getChildren`, `getProps`, `getState`, `getHooks`, `getErrors`,
`getComponentRenders`, `getProfileTimeline`, and `getRenderData`) use
columnar `cols` and `rows` output when two or more rows are returned. Their
tool-specific metadata remains present, and `next` replaces the page envelope
when another page is available.

`getTree`, `getChildren`, `searchNodes`, `getErrors`, `getComponentRenders`,
`getProfileTimeline`, and `getRenderData` return a trimmed
default column set (identifiers and labels, not every field such as `key`,
`parentId`, `changeTypeHints`, or `changedKeys`). Pass `--fields` or
`--verbose` to widen the projection. `getProps`, `getState`, and `getHooks`
always return both of their only two fields (`name`, `value`).

## Platform availability

React Native only. Lynx has no React DevTools backend, so this domain is
reported `unsupported` on a Lynx session. There is no substitute domain:
read component structure from source, and use plugin domains for runtime
state.
