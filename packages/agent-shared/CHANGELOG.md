# @rozenite/agent-shared

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
