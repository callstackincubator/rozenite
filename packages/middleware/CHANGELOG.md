# @rozenite/middleware

## 1.7.0

### Minor Changes

- [#216](https://github.com/callstackincubator/rozenite/pull/216) [`a826e35`](https://github.com/callstackincubator/rozenite/commit/a826e35ffadcf79b9d2f1bb033666d3b27d40752) Thanks [@V3RON](https://github.com/V3RON)! - Refactor the agent workflow to use Metro-backed session routes and shared transport types instead of the old daemon-oriented CLI flow.

  The agent bridge now re-registers in-app tools after session bootstrap, middleware waits for session bootstrap before exposing created sessions, and the packaged CLI skill/docs were updated to match the new session and artifact behavior.

### Patch Changes

- Updated dependencies [[`a826e35`](https://github.com/callstackincubator/rozenite/commit/a826e35ffadcf79b9d2f1bb033666d3b27d40752)]:
  - @rozenite/agent-shared@1.7.0
  - @rozenite/runtime@1.7.0
  - @rozenite/tools@1.7.0

## 1.6.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/runtime@1.6.0
  - @rozenite/tools@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/runtime@1.5.1
  - @rozenite/tools@1.5.1

## 1.5.0

### Minor Changes

- [#190](https://github.com/callstackincubator/rozenite/pull/190) [`5ae53a4`](https://github.com/callstackincubator/rozenite/commit/5ae53a4b509adbd8536ea24812f7ca523a95b625) Thanks [@V3RON](https://github.com/V3RON)! - Added Rozenite for Agents, including the new CLI agent workflow, shared agent packages, and middleware support for the new agent connection flow.

### Patch Changes

- [#176](https://github.com/callstackincubator/rozenite/pull/176) [`859a73b`](https://github.com/callstackincubator/rozenite/commit/859a73bb783e47f80fc8960ea404f3e65d4cee7e) Thanks [@leegeunhyeok](https://github.com/leegeunhyeok)! - Fixed plugin auto-discovery to work correctly with Yarn Plug'n'Play.

- Updated dependencies []:
  - @rozenite/runtime@1.5.0
  - @rozenite/tools@1.5.0

## 1.4.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/runtime@1.4.0
  - @rozenite/tools@1.4.0

## 1.3.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/runtime@1.3.0
  - @rozenite/tools@1.3.0
