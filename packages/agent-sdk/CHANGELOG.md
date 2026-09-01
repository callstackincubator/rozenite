# @rozenite/agent-sdk

## 2.3.0

### Minor Changes

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

- Updated dependencies [[`4afc448`](https://github.com/callstackincubator/rozenite/commit/4afc448f9e7dae4736155f173b7d726e31458d08), [`a1f5280`](https://github.com/callstackincubator/rozenite/commit/a1f5280e785e3db34b23b0877d52ad19c831dc88), [`c5a3cfc`](https://github.com/callstackincubator/rozenite/commit/c5a3cfc90abd6347ab0321590f7ca262896a1465)]:
  - @rozenite/tools@2.3.0
  - @rozenite/agent-shared@2.3.0

## 2.2.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-shared@2.2.0

## 2.1.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-shared@2.1.0

## 2.0.0

### Major Changes

- [#333](https://github.com/callstackincubator/rozenite/pull/333) [`f20d89d`](https://github.com/callstackincubator/rozenite/commit/f20d89d6f0f75fe364b7e7a3b6e76db7e2b3f77a) Thanks [@V3RON](https://github.com/V3RON)! - Remove SDK and CLI auto-pagination so every tool invocation performs exactly
  one call and preserves plugin-owned page results and cursors unchanged. Fetch
  additional pages by passing the returned cursor explicitly.

### Minor Changes

- [#335](https://github.com/callstackincubator/rozenite/pull/335) [`a57b914`](https://github.com/callstackincubator/rozenite/commit/a57b91448e6cc9b88bd987bf462f07deef6b0d55) Thanks [@V3RON](https://github.com/V3RON)! - Expose globally qualified tool names, descriptions, and optional safety traits
  in agent CLI tool discovery. Agent tool contracts now support `readOnly`,
  `destructive`, and `idempotent` metadata.

- [#328](https://github.com/callstackincubator/rozenite/pull/328) [`dc8b4ea`](https://github.com/callstackincubator/rozenite/commit/dc8b4eacbab70b871a02bdd93e0611a400b92ae2) Thanks [@V3RON](https://github.com/V3RON)! - Derive short, stable agent domain names from npm package names instead of mangled, hash-suffixed slugs. `@rozenite/mmkv-plugin` now resolves to the domain `mmkv` instead of `at-rozenite__mmkv-plugin`, and `@avasapp/rozenite-plugin-ably` resolves to `avasapp/ably`. The domain name is a pure function of the plugin's package name alone — installing, removing, or updating other plugins never changes it, and two packages that would derive the same domain name now fail loudly instead of one silently shadowing the other.

  The previous mangled slug form (e.g. `at-rozenite__mmkv-plugin`) is still accepted by `resolveDomainToken` as an undocumented compatibility alias for one release cycle.

### Patch Changes

- Updated dependencies [[`a57b914`](https://github.com/callstackincubator/rozenite/commit/a57b91448e6cc9b88bd987bf462f07deef6b0d55), [`fa96bb8`](https://github.com/callstackincubator/rozenite/commit/fa96bb84d53d264b1f30aa7034ec678711a2c6b1)]:
  - @rozenite/agent-shared@2.0.0

## 1.13.0

### Patch Changes

- [#307](https://github.com/callstackincubator/rozenite/pull/307) [`7b00844`](https://github.com/callstackincubator/rozenite/commit/7b00844e6439bb7447bc2b61519a6aa6fc1c270f) Thanks [@V3RON](https://github.com/V3RON)! - Derive the Agent debugger WebSocket `Origin` from the selected inspector URL and default local Agent connections to `127.0.0.1` so React Native origin checks accept Rozenite for Agents sessions.

- Updated dependencies [[`7b00844`](https://github.com/callstackincubator/rozenite/commit/7b00844e6439bb7447bc2b61519a6aa6fc1c270f)]:
  - @rozenite/agent-shared@1.13.0

## 1.12.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-shared@1.12.0

## 1.11.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-shared@1.11.0

## 1.10.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-shared@1.10.0

## 1.9.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-shared@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-shared@1.8.1

## 1.8.0

### Minor Changes

- [#222](https://github.com/callstackincubator/rozenite/pull/222) [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a) Thanks [@manapard](https://github.com/manapard)! - Add the first public Agent SDK for programmatic Rozenite agent workflows.

  The SDK now exposes `createAgentClient()` with `client.withSession(...)`,
  `client.openSession()`, and `client.attachSession()` for session-scoped work,
  plus `session.domains.*` and `session.tools.*` helpers for dynamic or
  descriptor-based tool calls.

  A new `@rozenite/agent-sdk/transport` subpath exposes the low-level HTTP
  transport used by the CLI, and the docs and packaged skills now include a
  dedicated `rozenite-agent-sdk` workflow.

### Patch Changes

- Updated dependencies [[`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a)]:
  - @rozenite/agent-shared@1.8.0
