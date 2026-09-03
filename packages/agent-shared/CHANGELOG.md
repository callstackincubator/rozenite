# @rozenite/agent-shared

## 2.4.0

### Minor Changes

- [#490](https://github.com/callstackincubator/rozenite/pull/490) [`3c4905f`](https://github.com/callstackincubator/rozenite/commit/3c4905f9e6a46f456b8ddd1dee209353b9e96c34) Thanks [@V3RON](https://github.com/V3RON)! - Targets returned by `rozenite open` and the agent's targets endpoint now
  report which integration (React Native or Lynx) serves them, and target
  discovery goes through one Rozenite endpoint on both integrations.

  `MetroTarget.pageId` is now the page's id within its own device (the
  `page` query parameter of `webSocketDebuggerUrl`) instead of the globally
  unique `<deviceId>-<pageId>` composite, so reconnecting after a disconnect
  correctly lands back on the page that was being debugged.

  `rozenite agent targets` now includes each target's `integration` in its
  output.

  The Lynx dev server no longer drops and re-registers every connected Lynx
  client on each of its periodic device-discovery sweeps, which showed up in
  Rozenite as a reconnect every fifteen seconds.

### Patch Changes

- Updated dependencies []:
  - @rozenite/tools@2.4.0

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

- [#433](https://github.com/callstackincubator/rozenite/pull/433) [`c5a3cfc`](https://github.com/callstackincubator/rozenite/commit/c5a3cfc90abd6347ab0321590f7ca262896a1465) Thanks [@V3RON](https://github.com/V3RON)! - Add `rozenite agent tap`, a CLI command that streams a Rozenite Agent session's plugin messages to stdout in both directions, without opening a browser or React Native DevTools. `--plugin` filters the stream to one plugin; `--type` and `--payload` send one message before watching, so a plugin's native side can be poked and its response observed directly from the terminal. Pass `--json` for newline-delimited JSON output.

  Because a device serves only one debugger connection at a time, a tap rides the same connection `rozenite agent` uses and replaces React Native DevTools if it is already attached, the same tradeoff `rozenite agent` already makes.

### Patch Changes

- Updated dependencies [[`4afc448`](https://github.com/callstackincubator/rozenite/commit/4afc448f9e7dae4736155f173b7d726e31458d08)]:
  - @rozenite/tools@2.3.0

## 2.2.0

## 2.1.0

## 2.0.0

### Minor Changes

- [#335](https://github.com/callstackincubator/rozenite/pull/335) [`a57b914`](https://github.com/callstackincubator/rozenite/commit/a57b91448e6cc9b88bd987bf462f07deef6b0d55) Thanks [@V3RON](https://github.com/V3RON)! - Expose globally qualified tool names, descriptions, and optional safety traits
  in agent CLI tool discovery. Agent tool contracts now support `readOnly`,
  `destructive`, and `idempotent` metadata.

- [#322](https://github.com/callstackincubator/rozenite/pull/322) [`fa96bb8`](https://github.com/callstackincubator/rozenite/commit/fa96bb84d53d264b1f30aa7034ec678711a2c6b1) Thanks [@V3RON](https://github.com/V3RON)! - Change agent CLI row-shaped output to the stable columnar `cols` / `rows`
  contract for two or more rows. Terminal pagination envelopes are removed, and
  additional pages now provide a runnable `next` command instead of a bare
  cursor. Paginated tools now declare their stable row fields through a reusable
  shared contract, re-exported from `@rozenite/agent-bridge`, so built-in and
  third-party plugins receive the same output behavior without CLI allowlists.

## 1.13.0

### Patch Changes

- [#307](https://github.com/callstackincubator/rozenite/pull/307) [`7b00844`](https://github.com/callstackincubator/rozenite/commit/7b00844e6439bb7447bc2b61519a6aa6fc1c270f) Thanks [@V3RON](https://github.com/V3RON)! - Derive the Agent debugger WebSocket `Origin` from the selected inspector URL and default local Agent connections to `127.0.0.1` so React Native origin checks accept Rozenite for Agents sessions.

## 1.12.0

## 1.11.0

## 1.10.0

## 1.9.0

## 1.8.1

## 1.8.0

### Minor Changes

- [#222](https://github.com/callstackincubator/rozenite/pull/222) [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a) Thanks [@manapard](https://github.com/manapard)! - Add typed agent tool contracts and descriptors that can be shared across runtime
  tool registration and SDK-facing plugin exports.

  `@rozenite/agent-shared` now exposes `defineAgentToolContract(...)`,
  `defineAgentToolDescriptor(...)`, and `defineAgentToolDescriptors(...)`, while
  `@rozenite/agent-bridge` can infer handler input and result types from typed
  tool contracts passed to `useRozeniteInAppAgentTool(...)` and
  `useRozenitePluginAgentTool(...)`.

## 1.7.0

### Minor Changes

- [#216](https://github.com/callstackincubator/rozenite/pull/216) [`a826e35`](https://github.com/callstackincubator/rozenite/commit/a826e35ffadcf79b9d2f1bb033666d3b27d40752) Thanks [@V3RON](https://github.com/V3RON)! - Refactor the agent workflow to use Metro-backed session routes and shared transport types instead of the old daemon-oriented CLI flow.

  The agent bridge now re-registers in-app tools after session bootstrap, middleware waits for session bootstrap before exposing created sessions, and the packaged CLI skill/docs were updated to match the new session and artifact behavior.

## 1.6.0

## 1.5.1

### Patch Changes

- Fixed missing artifacts (CJS) for the agents packages.

## 1.5.0

### Minor Changes

- [#190](https://github.com/callstackincubator/rozenite/pull/190) [`5ae53a4`](https://github.com/callstackincubator/rozenite/commit/5ae53a4b509adbd8536ea24812f7ca523a95b625) Thanks [@V3RON](https://github.com/V3RON)! - Added Rozenite for Agents, including the new CLI agent workflow, shared agent packages, and middleware support for the new agent connection flow.
