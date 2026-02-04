# React Domain

Search and traverse the React component tree, read props, state, and hooks for any node, and record render timelines (start/stop profiling, then fetch commit data) for performance analysis.

## Tools
- `searchNodes` -> `{"query":"<query>"}` | `{"query":"<query>","cursor":"<cursor>"}` | `{"query":"<query>","limit":20}`
- `getNode` -> `{"nodeId":123}`
- `getChildren` -> `{"nodeId":123}` | `{"nodeId":123,"cursor":"<cursor>"}` | `{"nodeId":123,"limit":20}`
- `getProps` -> `{"nodeId":123}` | `{"nodeId":123,"cursor":"<cursor>"}` | `{"nodeId":123,"limit":20}`
- `getState` -> `{"nodeId":123}` | `{"nodeId":123,"cursor":"<cursor>"}` | `{"nodeId":123,"limit":20}`
- `getHooks` -> `{"nodeId":123}` | `{"nodeId":123,"path":[0,"subHooks",1]}` | `{"nodeId":123,"limit":20}`
- `startProfiling` -> `{}` | `{"shouldRestart":true}`
- `isProfilingStarted` -> `{}`
- `stopProfiling` -> `{}` | `{"waitForDataMs":3000}` | `{"slowRenderThresholdMs":16}`
- `getRenderData` -> `{"rootId":1,"commitIndex":0}` | `{"rootId":1,"commitIndex":0,"cursor":"<cursor>"}` | `{"rootId":1,"commitIndex":0,"limit":20}`

## Minimal Flow
Searching and inspecting:
`searchNodes` -> `getNode` / `getChildren` -> `getProps` / `getState` / `getHooks`.

Profiling:
`startProfiling` -> reproduce interaction -> `stopProfiling` -> `getRenderData`.
