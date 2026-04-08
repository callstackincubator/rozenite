# @rozenite/agent-shared

## 1.7.0-rc.1

### Minor Changes

- [`525a35b`](https://github.com/callstackincubator/rozenite/commit/525a35b3afe0b7989b69d591d8db19b99ad0b812) Thanks [@V3RON](https://github.com/V3RON)! - Refactor the agent workflow to use Metro-backed session routes and shared transport types instead of the old daemon-oriented CLI flow.

  The agent bridge now re-registers in-app tools after session bootstrap, middleware waits for session bootstrap before exposing created sessions, and the packaged CLI skill/docs were updated to match the new session and artifact behavior.

## 1.7.0-rc.0

## 1.6.0

## 1.5.1

### Patch Changes

- Fixed missing artifacts (CJS) for the agents packages.

## 1.5.0

### Minor Changes

- [#190](https://github.com/callstackincubator/rozenite/pull/190) [`5ae53a4`](https://github.com/callstackincubator/rozenite/commit/5ae53a4b509adbd8536ea24812f7ca523a95b625) Thanks [@V3RON](https://github.com/V3RON)! - Added Rozenite for Agents, including the new CLI agent workflow, shared agent packages, and middleware support for the new agent connection flow.
