# @rozenite/middleware

## 2.1.0

### Minor Changes

- [#403](https://github.com/callstackincubator/rozenite/pull/403) [`96c9ed7`](https://github.com/callstackincubator/rozenite/commit/96c9ed7f938e84a7b5045da602698e878325a05e) Thanks [@AndreiCalazans](https://github.com/AndreiCalazans)! - Enrich the `getRenderData` agent tool so each rendered fiber also reports its resolved `displayName` and a `changedKeys` object — the exact changed prop/state/context key names plus `hooks`/`isFirstMount` flags — alongside the existing category-level `changeTypeHints`. This lets a coding agent (or a human) see not just that a component re-rendered, but which specific props/state/context/hooks invalidated it, without a second round-trip to resolve fiber IDs to component names.

### Patch Changes

- [#388](https://github.com/callstackincubator/rozenite/pull/388) [`af2d6a0`](https://github.com/callstackincubator/rozenite/commit/af2d6a06c4f716200affe876af8d8f8c767d5acd) Thanks [@V3RON](https://github.com/V3RON)! - Fix Metro/Re.Pack dev server startup stalling on slow or network-backed
  filesystems. Plugin auto-discovery now resolves dependencies concurrently
  instead of scanning them one at a time, and resolves hoisted packages
  directly instead of always paying for full module resolution.
- Updated dependencies [[`629df05`](https://github.com/callstackincubator/rozenite/commit/629df051e4ef08775a9a4e1a008aba819d7be05d)]:
  - @rozenite/shell@2.1.0
  - @rozenite/runtime@2.1.0
  - @rozenite/agent-shared@2.1.0
  - @rozenite/tools@2.1.0

## 2.0.0

### Minor Changes

- [#355](https://github.com/callstackincubator/rozenite/pull/355) [`ea5a01f`](https://github.com/callstackincubator/rozenite/commit/ea5a01fa86bc5f716896483fa6e1a49c283e6097) Thanks [@V3RON](https://github.com/V3RON)! - Show plugin panels in a unified Rozenite sidebar by default, with an option to
  keep the individual DevTools tabs presentation.

### Patch Changes

- [#321](https://github.com/callstackincubator/rozenite/pull/321) [`94941d2`](https://github.com/callstackincubator/rozenite/commit/94941d23af5cb99077a41a8c6e405edffccd2467) Thanks [@V3RON](https://github.com/V3RON)! - Agent sessions now automatically recover after an app relaunch while keeping their session ID and restoring tools. If a relaunch interrupts profiling or recording, Rozenite reports the lost data instead of returning a misleading empty result.

- [#325](https://github.com/callstackincubator/rozenite/pull/325) [`bd3a5a8`](https://github.com/callstackincubator/rozenite/commit/bd3a5a8ad53628d0010a23e636abc9500a295950) Thanks [@V3RON](https://github.com/V3RON)! - Fix network agent domain not resetting the captured request buffer on disconnect, which allowed a rebind (e.g. after an app relaunch) to serve requests from the previous app run and resume pagination cursors into the wrong buffer.

- [#326](https://github.com/callstackincubator/rozenite/pull/326) [`cdd656b`](https://github.com/callstackincubator/rozenite/commit/cdd656bac330240543d6626c6e13bb2b0c3dd2a4) Thanks [@V3RON](https://github.com/V3RON)! - Fix `react.stopProfiling` agent tool returning an empty success result instead of erroring when called with no active profiling session. It now throws `No active profiling session for this session`, matching the guard used by the other stop-style agent tools (`network.stopRecording`, `performance.stopTrace`, `memory.stopSampling`).

- Updated dependencies [[`a57b914`](https://github.com/callstackincubator/rozenite/commit/a57b91448e6cc9b88bd987bf462f07deef6b0d55), [`fa96bb8`](https://github.com/callstackincubator/rozenite/commit/fa96bb84d53d264b1f30aa7034ec678711a2c6b1), [`dd0146d`](https://github.com/callstackincubator/rozenite/commit/dd0146d0773885fb19d756c60adb81ab5f251ef2), [`893f238`](https://github.com/callstackincubator/rozenite/commit/893f238c9e7015776ccb79915620271785227022), [`e88b100`](https://github.com/callstackincubator/rozenite/commit/e88b10051a2e0c56c67202b7ba74fbf3241744de), [`7b138a5`](https://github.com/callstackincubator/rozenite/commit/7b138a54462a4340f33e895a7cc17583078a8e96), [`ea5a01f`](https://github.com/callstackincubator/rozenite/commit/ea5a01fa86bc5f716896483fa6e1a49c283e6097)]:
  - @rozenite/agent-shared@2.0.0
  - @rozenite/runtime@2.0.0
  - @rozenite/shell@2.0.0
  - @rozenite/tools@2.0.0

## 1.13.0

### Patch Changes

- [#307](https://github.com/callstackincubator/rozenite/pull/307) [`7b00844`](https://github.com/callstackincubator/rozenite/commit/7b00844e6439bb7447bc2b61519a6aa6fc1c270f) Thanks [@V3RON](https://github.com/V3RON)! - Derive the Agent debugger WebSocket `Origin` from the selected inspector URL and default local Agent connections to `127.0.0.1` so React Native origin checks accept Rozenite for Agents sessions.

- [#306](https://github.com/callstackincubator/rozenite/pull/306) [`7b41dad`](https://github.com/callstackincubator/rozenite/commit/7b41dad5d54fcb342693059c48af3976213a9a2d) Thanks [@V3RON](https://github.com/V3RON)! - Add `getComponent` to the React agent so inspected component data can be fetched from a live session.

- [#304](https://github.com/callstackincubator/rozenite/pull/304) [`58c98ec`](https://github.com/callstackincubator/rozenite/commit/58c98ece9fd470396ed32687cdd069a8b558e927) Thanks [@V3RON](https://github.com/V3RON)! - Add `getTree` to the React agent so the current tree can be fetched and paged from the live app.

- [#305](https://github.com/callstackincubator/rozenite/pull/305) [`ec6224f`](https://github.com/callstackincubator/rozenite/commit/ec6224ffa45647c184717d08f7c8826af42683f0) Thanks [@V3RON](https://github.com/V3RON)! - Add stable React component labels so nodes can be looked up by labels like `@c2` across the React agent tools.

- Updated dependencies [[`7b00844`](https://github.com/callstackincubator/rozenite/commit/7b00844e6439bb7447bc2b61519a6aa6fc1c270f)]:
  - @rozenite/agent-shared@1.13.0
  - @rozenite/runtime@1.13.0
  - @rozenite/tools@1.13.0

## 1.12.0

### Patch Changes

- [#299](https://github.com/callstackincubator/rozenite/pull/299) [`f09db8d`](https://github.com/callstackincubator/rozenite/commit/f09db8d79f6a6b2b1beb0de1d7f31c487cbcfe32) Thanks [@V3RON](https://github.com/V3RON)! - Avoid unhandled rejections when pending CDP commands are left behind during websocket teardown.

- [#297](https://github.com/callstackincubator/rozenite/pull/297) [`68db2fb`](https://github.com/callstackincubator/rozenite/commit/68db2fb834646064b03ffc1a24457d795abbac3d) Thanks [@V3RON](https://github.com/V3RON)! - Set the debugger WebSocket origin to `http://localhost:<port>` for better compatibility with local dev servers.

- Updated dependencies []:
  - @rozenite/agent-shared@1.12.0
  - @rozenite/runtime@1.12.0
  - @rozenite/tools@1.12.0

## 1.11.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-shared@1.11.0
  - @rozenite/runtime@1.11.0
  - @rozenite/tools@1.11.0

## 1.10.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-shared@1.10.0
  - @rozenite/runtime@1.10.0
  - @rozenite/tools@1.10.0

## 1.9.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-shared@1.9.0
  - @rozenite/runtime@1.9.0
  - @rozenite/tools@1.9.0

## 1.8.1

### Patch Changes

- [#236](https://github.com/callstackincubator/rozenite/pull/236) [`3ad44bb`](https://github.com/callstackincubator/rozenite/commit/3ad44bb39b0ebca67dc233729f94ddc4467514cb) Thanks [@V3RON](https://github.com/V3RON)! - Fix scoped Rozenite middleware so agent setup requests still resolve after the
  outer `/rozenite` prefix is stripped by Metro integrations.
- Updated dependencies []:
  - @rozenite/agent-shared@1.8.1
  - @rozenite/runtime@1.8.1
  - @rozenite/tools@1.8.1

## 1.8.0

### Patch Changes

- [#230](https://github.com/callstackincubator/rozenite/pull/230) [`e1e5bd7`](https://github.com/callstackincubator/rozenite/commit/e1e5bd721032d3ddd0b7f16c26466f76d4c846a1) Thanks [@V3RON](https://github.com/V3RON)! - Fix an issue where opening a stack frame from Rozenite could land in the wrong place.

- [#222](https://github.com/callstackincubator/rozenite/pull/222) [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a) Thanks [@manapard](https://github.com/manapard)! - Fix agent session startup so `createSession()` waits for mounted plugin registrations to settle before returning, reducing races when calling plugin tools immediately after session creation.

- Updated dependencies [[`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a)]:
  - @rozenite/agent-shared@1.8.0
  - @rozenite/runtime@1.8.0
  - @rozenite/tools@1.8.0

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
