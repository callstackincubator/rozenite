---
name: sdk
description: Programmatic `@rozenite/agent-sdk` usage in Node.js/TypeScript — session lifecycle, tool discovery, typed plugin calls, and pagination.
---

# SDK

Use this doc for programmatic access to Rozenite for Agents through
`@rozenite/agent-sdk` in Node.js or TypeScript code. Read the `core` doc
first for ground truths shared with the CLI workflow (built-in domains,
plugin domain tokens, and when live session data beats source code).

If the task is shell-driven, needs a reusable CLI session, operates directly
through `rozenite agent ...`, or requires target enumeration before choosing
a `deviceId`, use the `cli` doc instead.

Read `sdk-patterns` for copy-pastable code examples covering everything
below.

## Rules

- Prefer throwaway Node ESM scripts that import `@rozenite/agent-sdk`.
- Default flow: `createAgentClient()` -> `client.withSession(...)` -> inspect or call tools -> exit.
- Use `session.domains.list()` as the source of truth for live built-in and runtime domains.
- Use `session.tools.list({ domain })` and `session.tools.getSchema({ domain, tool })` only when you need live inspection or argument confirmation.
- Prefer typed plugin SDK descriptors from any available official plugin `./sdk` export and call tools as `session.tools.call(descriptor, args)`.
- Fall back to `session.tools.call({ domain, tool, args })` only when no matching `./sdk` descriptor is available or the tool is discovered dynamically at runtime.
- When you discover tools through `session.tools.list({ domain })`, treat the returned `shortName` as the canonical tool name to pass back into a later call-by-name invocation. Do not invent camelCase aliases or normalize tool names yourself.
- Prefer stable SDK domain identifiers such as built-in domain IDs (`network`, `react`, `memory`) and plugin IDs (`@rozenite/storage-plugin`, `@rozenite/tanstack-query-plugin`) over the derived, CLI-facing domain token like `storage`.
- For paged tools, make one call at a time and pass the returned `page.nextCursor` explicitly in the next call. The plugin owns its page envelope and cursor.
- If a plugin only mounts after navigation, navigate first, then refresh the live view with `session.domains.list()` or `session.tools.list(...)` before calling the plugin tool.
- For advanced session control with `client.openSession()` or `client.attachSession(sessionId)`, see `sdk-patterns`.
- If a script encounters an unexpected runtime error, let the script fail clearly. Do not hide the failure by printing placeholder JSON.
