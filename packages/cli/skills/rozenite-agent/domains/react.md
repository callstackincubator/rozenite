Search and traverse the React component tree, read props, state, and hooks for any node, and record render timelines for performance analysis by starting and stopping profiling, then fetching commit data.

## Tools

- `searchNodes` -> `{"query":"<query>"}` | `{"query":"<query>","cursor":"<cursor>"}` | `{"query":"<query>","limit":20}`
- `getNode` -> `{"nodeId":123}` | `{"id":"@c2"}`
- `getChildren` -> `{"nodeId":123}` | `{"id":"@c2","cursor":"<cursor>"}` | `{"id":"@c2","limit":20}`
- `getProps` -> `{"nodeId":123}` | `{"id":"@c2","cursor":"<cursor>"}` | `{"id":"@c2","limit":20}`
- `getState` -> `{"nodeId":123}` | `{"id":"@c2","cursor":"<cursor>"}` | `{"id":"@c2","limit":20}`
- `getHooks` -> `{"nodeId":123}` | `{"id":"@c2","path":[0,"subHooks",1]}` | `{"id":"@c2","limit":20}`
- `startProfiling` -> `{}` | `{"shouldRestart":true}`
- `isProfilingStarted` -> `{}`
- `stopProfiling` -> `{}` | `{"waitForDataMs":3000}` | `{"slowRenderThresholdMs":16}`
- `getRenderData` -> `{"rootId":1,"commitIndex":0}` | `{"rootId":1,"commitIndex":0,"cursor":"<cursor>"}` | `{"rootId":1,"commitIndex":0,"limit":20}`

## Flow

Search and inspect:
`searchNodes` -> `getNode` / `getChildren` -> `getProps` / `getState` / `getHooks`.

Profile:
`startProfiling` -> reproduce interaction -> `stopProfiling` -> `getRenderData`.
