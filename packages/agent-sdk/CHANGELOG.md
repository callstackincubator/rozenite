# @rozenite/agent-sdk

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
