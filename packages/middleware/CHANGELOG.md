# @rozenite/middleware

## 2.3.0

### Minor Changes

- [#432](https://github.com/callstackincubator/rozenite/pull/432) [`907ba2f`](https://github.com/callstackincubator/rozenite/commit/907ba2ff79125b52577db0ef1bd683e2f8c5ca4d) Thanks [@V3RON](https://github.com/V3RON)! - Make the agent `console` domain usable on long sessions and readable for the
  logs that matter. Object arguments now render their contents — `console.log({
userId: 42 })` reports `{userId: 42}` instead of `Object`, and arrays render
  their elements with an explicit overflow marker — while every rendered value is
  length-capped, so a single multi-megabyte string can no longer sit in the buffer
  (and each entry is stored once rather than twice). The per-device buffer is a
  true ring buffer, so appending costs the same whether it is empty or full, and a
  read seeks straight to its starting position and stops once the page is filled
  instead of filtering, sorting, copying, and reversing the whole buffer.

  `getMessages` items now carry a `cursor`, and the tool accepts `before` and
  `after` bounds, so an agent can find an error under a level filter and then read
  the entries surrounding it — including under different filters — in one
  follow-up call. Cursors are now plain opaque positions: they are no longer bound
  to the filters or sort order of the request that produced them, which is what
  makes reading around an entry possible and shrinks each cursor by ~96%.

  Breaking: the `argsPreview` field is gone from `getMessages` (it only ever
  repeated `text`, and was never part of the default projection), and cursors from
  an older session are not accepted by this version.

- [#456](https://github.com/callstackincubator/rozenite/pull/456) [`4afc448`](https://github.com/callstackincubator/rozenite/commit/4afc448f9e7dae4736155f173b7d726e31458d08) Thanks [@V3RON](https://github.com/V3RON)! - Lay the groundwork for refusing a plugin on an integration it doesn't support, instead of loading it and breaking. Plugins can now declare which environments they work in — `react-native`, `react-native-web`, `lynx`, or `lynx-web` — via `integrations` in `rozenite.config.ts`; omitting it defaults to `['react-native']`, and the resolved list is always reported in the plugin manifest. Nothing enforces compatibility yet — that's a follow-up.

  Resolving which integration a connected target actually is takes two halves. The dev server supplies the host it serves (`react-native` or `lynx`), which follows from the installed integration and so cannot be wrong. The other half — whether the target is a browser — is answered by the device itself: both DevTools hosts evaluate a small self-contained expression in the connected runtime during bootstrap, and `resolveIntegration` combines the two. Asking the device is what makes the answer immediate and certain; the alternative was reading React Native's `ReactNativeApplication.metadataUpdated`, an event Rozenite neither emits nor can order, so a host that asked early would report a browser target as native with no way to tell that answer from a real one. A probe that fails leaves the target unknown rather than guessing.

  `@rozenite/middleware`'s `platform` config option, unreleased until now, is renamed to `integration` to avoid colliding with the device-OS meaning `platform` carries everywhere else in the system.

- [#448](https://github.com/callstackincubator/rozenite/pull/448) [`a1f5280`](https://github.com/callstackincubator/rozenite/commit/a1f5280e785e3db34b23b0877d52ad19c831dc88) Thanks [@V3RON](https://github.com/V3RON)! - Teach Rozenite for Agents which built-in domains the connected target can
  actually back, so a Lynx session no longer looks like a React Native one.

  The five built-in domains were designed against React Native's CDP surface, and
  Lynx exposes a different one: it registers no `Network` domain at all, has no
  React DevTools backend, and implements a Perfetto-based `Tracing` domain that
  shares Chrome's method names but not its protocol. Until now every session
  advertised all five regardless, so an agent on a Lynx target could only find out
  by calling — and two of the three ways that fails are silent. `network` errored
  with a raw protocol code, `react` returned nothing, `performance` finalised a
  trace artifact containing zero events, and heap sampling appeared to start and
  collected nothing.

  Each session now resolves a capability profile from the integration its dev
  server hosts.
  Unsupported tools are never registered, so `list-tools` is honest; unavailable
  domains stay visible in `rozenite agent domains` with an `availability` column, a
  reason, and — for `network` — the `@rozenite/network-activity-plugin` domain to
  use instead. Calling an unsupported tool fails during resolution with that same
  explanation rather than a protocol error, so the agent gets a next step instead
  of a dead end. On Lynx that means `console`, plugin domains, app tools and
  `memory.takeHeapSnapshot` are reported supported, `memory` is degraded, and
  `network`, `react` and `performance` are unavailable with reasons.

  Three fixes to the CDP command channel apply to every integration, not just
  Lynx. A
  device error now names the method it refused instead of arriving as a stringified
  error object; waits on a device event are bounded, so a capture whose completion
  event never arrives fails with a diagnosis instead of hanging forever; and
  `stopTrace` refuses to hand back a trace artifact containing no events rather
  than reporting a successful capture of nothing.

  Both new fields on the session tools response are optional, so a CLI and a Metro
  on different versions keep working together — an older server simply reports no
  capability data and every domain is treated as supported, exactly as before.

- [#472](https://github.com/callstackincubator/rozenite/pull/472) [`312fd97`](https://github.com/callstackincubator/rozenite/commit/312fd9769daa6f357a0027efe825b55cd956145c) Thanks [@V3RON](https://github.com/V3RON)! - Make the React agent domain answer render-performance questions in one call, and
  cut the noise out of component-tree reads.

  - `getComponentRenders` aggregates a whole profiling session into one row per
    component — render count, total/average/max render time, and why it rendered —
    so "what was slow" and "what re-rendered too often" no longer mean paging
    `getRenderData` once per commit.
  - `getProfileTimeline` lists every commit with its duration and rendered-fiber
    count, chronologically or slowest first, and stays queryable after
    `stopProfiling`.
  - `getErrors` lists the components React logged errors or warnings against;
    those counts now appear on ordinary tree and node reads too.
  - `getTree`, `getChildren`, and `searchNodes` accept `noHost: true`, which hides
    plain host components and promotes their children to the nearest visible
    ancestor. Off by default, and largely a safety net: React DevTools already
    hides host components at the backend, so they rarely reach the tree at all.
  - `getComponent`, `getProps`, `getState`, and `getHooks` accept `maxValueLength`
    (default 512) so a single base64 or serialized-blob prop cannot dominate a
    response.

- [#433](https://github.com/callstackincubator/rozenite/pull/433) [`c5a3cfc`](https://github.com/callstackincubator/rozenite/commit/c5a3cfc90abd6347ab0321590f7ca262896a1465) Thanks [@V3RON](https://github.com/V3RON)! - Add `rozenite agent tap`, a CLI command that streams a Rozenite Agent session's plugin messages to stdout in both directions, without opening a browser or React Native DevTools. `--plugin` filters the stream to one plugin; `--type` and `--payload` send one message before watching, so a plugin's native side can be poked and its response observed directly from the terminal. Pass `--json` for newline-delimited JSON output.

  Because a device serves only one debugger connection at a time, a tap rides the same connection `rozenite agent` uses and replaces React Native DevTools if it is already attached, the same tradeoff `rozenite agent` already makes.

### Patch Changes

- [#470](https://github.com/callstackincubator/rozenite/pull/470) [`81227b3`](https://github.com/callstackincubator/rozenite/commit/81227b335ee32a1f16ebb9e35c39c46b7a470a72) Thanks [@V3RON](https://github.com/V3RON)! - Fix Rozenite for Agents failing every tool call on Lynx targets. A capability-filtered domain answered for tools it did not own, which aborted the dispatch walk on its first step and reported the React domain's reason whatever domain was asked for.

- [#468](https://github.com/callstackincubator/rozenite/pull/468) [`1c95b0f`](https://github.com/callstackincubator/rozenite/commit/1c95b0f90f9cacf1ca061a8809fc68073e0c3792) Thanks [@V3RON](https://github.com/V3RON)! - Fix Rozenite for Agents failing to connect with `CDP connection closed before
bootstrap completed` on Expo dev servers whose configured host differs from the
  address the agent reached them through, such as when
  `REACT_NATIVE_PACKAGER_HOSTNAME` is set.

- [#478](https://github.com/callstackincubator/rozenite/pull/478) [`5b033db`](https://github.com/callstackincubator/rozenite/commit/5b033dbae60572c442e370246d18ffae8dd78e14) Thanks [@V3RON](https://github.com/V3RON)! - Expose commit cost beyond render time in the React agent `getProfileTimeline` tool. Each commit can now report `effectDurationMs`, `passiveEffectDurationMs`, `priorityLevel`, `updaterCount` and `hasChangeDescriptions`, so a commit that renders quickly but commits slowly is visible without a separate call.

- [#477](https://github.com/callstackincubator/rozenite/pull/477) [`f74f1be`](https://github.com/callstackincubator/rozenite/commit/f74f1be7920c93c64b2e5561048a33d7c3a66dc9) Thanks [@V3RON](https://github.com/V3RON)! - Fix React DevTools agent tools silently losing their outbound channel after the app restarts. The session now re-binds the React domain to the device when it reconnects, so `getProps`, `getComponent` and profiling keep working instead of failing with an unavailable-channel error or hanging on `isProcessingData`.

- Updated dependencies [[`b758637`](https://github.com/callstackincubator/rozenite/commit/b758637fd6af638d9b214849d390163ce4efda19), [`4afc448`](https://github.com/callstackincubator/rozenite/commit/4afc448f9e7dae4736155f173b7d726e31458d08), [`a1f5280`](https://github.com/callstackincubator/rozenite/commit/a1f5280e785e3db34b23b0877d52ad19c831dc88), [`c5a3cfc`](https://github.com/callstackincubator/rozenite/commit/c5a3cfc90abd6347ab0321590f7ca262896a1465)]:
  - @rozenite/app@2.3.0
  - @rozenite/tools@2.3.0
  - @rozenite/runtime@2.3.0
  - @rozenite/agent-shared@2.3.0
  - @rozenite/shell@2.3.0

## 2.2.0

### Minor Changes

- [#422](https://github.com/callstackincubator/rozenite/pull/422) [`2d9ad00`](https://github.com/callstackincubator/rozenite/commit/2d9ad00a225663d300bddc7cd4236f3665443bcb) Thanks [@V3RON](https://github.com/V3RON)! - Add a standalone Rozenite app that runs the DevTools panel UI in its own browser window instead of inside React Native DevTools. Run `rozenite open` to pick a connected device and open it. Because panels live outside the DevTools frontend, they stay mounted across a JS-VM reload instead of being torn down and recreated — the app reconnects to the device in the background while your panels keep their state.

  The standalone app is opt-in and connects directly to the device, so it competes with React Native DevTools and `rozenite agent` for the same debugger connection; only one can be attached at a time.

### Patch Changes

- Updated dependencies [[`4f5fe74`](https://github.com/callstackincubator/rozenite/commit/4f5fe747ca0c6e93d0bf05076c7e2e2ad25fd744), [`485df5b`](https://github.com/callstackincubator/rozenite/commit/485df5bf6d5714246bd9ee8f691d52f408214e82), [`2d9ad00`](https://github.com/callstackincubator/rozenite/commit/2d9ad00a225663d300bddc7cd4236f3665443bcb)]:
  - @rozenite/shell@2.2.0
  - @rozenite/runtime@2.2.0
  - @rozenite/app@2.2.0
  - @rozenite/agent-shared@2.2.0
  - @rozenite/tools@2.2.0

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
