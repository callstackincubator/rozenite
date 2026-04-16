---
'@rozenite/agent-sdk': minor
'rozenite': minor
---

Add the first public Agent SDK for programmatic Rozenite agent workflows.

The SDK now exposes `createAgentClient()` with `client.withSession(...)`,
`client.openSession()`, and `client.attachSession()` for session-scoped work,
plus `session.domains.*` and `session.tools.*` helpers for dynamic or
descriptor-based tool calls.

A new `@rozenite/agent-sdk/transport` subpath exposes the low-level HTTP
transport used by the CLI, and the docs and packaged skills now include a
dedicated `rozenite-agent-sdk` workflow.
