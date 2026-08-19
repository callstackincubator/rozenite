# @rozenite/agent-sdk

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
