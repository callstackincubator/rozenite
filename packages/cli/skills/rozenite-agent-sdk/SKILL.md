---
name: rozenite-agent-sdk
description: Use Rozenite for Agents through `@rozenite/agent-sdk` in Node.js or TypeScript code. Trigger this skill when Codex needs to write or run scripts, wrappers, automations, benchmarks, or agent runtimes that call Rozenite programmatically instead of driving the `rozenite agent` CLI directly.
---

# Rozenite Agent SDK

Use this skill when the user wants code-first access to Rozenite for Agents.

Read `references/code-patterns.md` for copy-pastable examples.

## Rules

- Prefer throwaway Node ESM scripts that import `@rozenite/agent-sdk`.
- Default flow: `createAgentClient()` -> `client.withSession(...)` -> inspect or call tools -> exit.
- Use `session.domains.list()` as the source of truth for live built-in and runtime domains.
- Use `session.tools.list({ domain })` and `session.tools.getSchema({ domain, tool })` only when you need live inspection or argument confirmation.
- Prefer typed plugin SDK descriptors from any available official plugin `./sdk` export and call tools as `session.tools.call(descriptor, args)`.
- Fall back to `session.tools.call({ domain, tool, args })` only when no matching `./sdk` descriptor is available or the tool is discovered dynamically at runtime.
- When you discover tools through `session.tools.list({ domain })`, treat the returned `shortName` as the canonical tool name to pass back into a later call-by-name invocation. Do not invent camelCase aliases or normalize tool names yourself.
- Prefer stable SDK domain identifiers such as built-in domain IDs (`network`, `react`, `memory`) and plugin IDs (`@rozenite/storage-plugin`, `@rozenite/tanstack-query-plugin`) over CLI-only live domain tokens like `at-rozenite__storage-plugin`.
- If paged results should be merged automatically, use `autoPaginate`.
- If a plugin only mounts after navigation, navigate first, then refresh the live view with `session.domains.list()` or `session.tools.list(...)` before calling the plugin tool.
- For advanced session control with `client.openSession()` or `client.attachSession(sessionId)`, see the reference patterns.
- If a script encounters an unexpected runtime error, let the script fail clearly. Do not hide the failure by printing placeholder JSON.

## Handoff

- Use `rozenite-agent` instead when the task is shell-driven, needs a reusable CLI session, operates directly through `rozenite agent ...`, or requires target enumeration before choosing a `deviceId`.
