---
name: react
description: Search and traverse the React component tree, read props/state/hooks, and record render timelines via profiling.
domain: react
integrations: react-native
---

Search and traverse the React component tree, read props, state, and hooks for any node, and record render timelines for performance analysis by starting and stopping profiling, then fetching commit data.

## Tools

- `searchNodes` -> `{"query":"<query>"}` | `{"query":"<query>","cursor":"<cursor>"}` | `{"query":"<query>","limit":20}`
- `getTree` -> `{}` | `{"depth":2}` | `{"root":123}` | `{"cursor":"<cursor>"}`
- `getComponent` -> `{"id":123}` | `{"nodeId":123}` | `{"id":123,"include":["props"]}`
- `getNode` -> `{"nodeId":123}`
- `getChildren` -> `{"nodeId":123}` | `{"nodeId":123,"cursor":"<cursor>"}` | `{"nodeId":123,"limit":20}`
- `getProps` -> `{"nodeId":123}` | `{"nodeId":123,"cursor":"<cursor>"}` | `{"nodeId":123,"limit":20}`
- `getState` -> `{"nodeId":123}` | `{"nodeId":123,"cursor":"<cursor>"}` | `{"nodeId":123,"limit":20}`
- `getHooks` -> `{"nodeId":123}` | `{"nodeId":123,"path":[0,"subHooks",1]}` | `{"nodeId":123,"limit":20}`
- `startProfiling` -> `{}` | `{"shouldRestart":true}`
- `isProfilingStarted` -> `{}`
- `stopProfiling` -> `{}` | `{"waitForDataMs":3000}` | `{"slowRenderThresholdMs":16}`
- `getRenderData` -> `{"rootId":1,"commitIndex":0}` | `{"rootId":1,"commitIndex":0,"cursor":"<cursor>"}` | `{"rootId":1,"commitIndex":0,"limit":20}`

## Flow

Search and inspect:
`getTree` / `searchNodes` -> `getComponent` / `getNode` / `getChildren` -> `getProps` / `getState` / `getHooks`.

Profile:
`startProfiling` -> reproduce interaction -> `stopProfiling` -> `getRenderData`.

`getRenderData` rows carry `displayName` and timing by default. Add
`--fields ...,changedKeys` for the exact changed prop, state, and context key
names behind `changeTypeHints`, which attributes a re-render without a
follow-up `getComponent` call per fiber.

CLI discovery listings and paginated React calls (`getTree`, `searchNodes`,
`getChildren`, `getProps`, `getState`, `getHooks`, and `getRenderData`) use
columnar `cols` and `rows` output when two or more rows are returned. Their
tool-specific metadata remains present, and `next` replaces the page envelope
when another page is available.

`getTree`, `getChildren`, `searchNodes`, and `getRenderData` return a trimmed
default column set (identifiers and labels, not every field such as `key`,
`parentId`, `changeTypeHints`, or `changedKeys`). Pass `--fields` or
`--verbose` to widen the projection. `getProps`, `getState`, and `getHooks`
always return both of their only two fields (`name`, `value`).

## Platform availability

React Native only. Lynx has no React DevTools backend, so this domain is
reported `unsupported` on a Lynx session. There is no substitute domain:
read component structure from source, and use plugin domains for runtime
state.
