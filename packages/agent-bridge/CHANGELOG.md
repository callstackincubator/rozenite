# @rozenite/agent-bridge

## 1.7.0

### Minor Changes

- [#216](https://github.com/callstackincubator/rozenite/pull/216) [`a826e35`](https://github.com/callstackincubator/rozenite/commit/a826e35ffadcf79b9d2f1bb033666d3b27d40752) Thanks [@V3RON](https://github.com/V3RON)! - Refactor the agent workflow to use Metro-backed session routes and shared transport types instead of the old daemon-oriented CLI flow.

  The agent bridge now re-registers in-app tools after session bootstrap, middleware waits for session bootstrap before exposing created sessions, and the packaged CLI skill/docs were updated to match the new session and artifact behavior.

### Patch Changes

- Updated dependencies [[`a826e35`](https://github.com/callstackincubator/rozenite/commit/a826e35ffadcf79b9d2f1bb033666d3b27d40752)]:
  - @rozenite/agent-shared@1.7.0
  - @rozenite/plugin-bridge@1.7.0

## 1.6.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-shared@1.6.0
  - @rozenite/plugin-bridge@1.6.0

## 1.5.1

### Patch Changes

- Fixed missing artifacts (CJS) for the agents packages.

- Updated dependencies []:
  - @rozenite/agent-shared@1.5.1
  - @rozenite/plugin-bridge@1.5.1

## 1.5.0

### Minor Changes

- [#190](https://github.com/callstackincubator/rozenite/pull/190) [`5ae53a4`](https://github.com/callstackincubator/rozenite/commit/5ae53a4b509adbd8536ea24812f7ca523a95b625) Thanks [@V3RON](https://github.com/V3RON)! - Added Rozenite for Agents, including the new CLI agent workflow, shared agent packages, and middleware support for the new agent connection flow.

### Patch Changes

- Updated dependencies [[`5ae53a4`](https://github.com/callstackincubator/rozenite/commit/5ae53a4b509adbd8536ea24812f7ca523a95b625)]:
  - @rozenite/agent-shared@1.5.0
  - @rozenite/plugin-bridge@1.5.0
