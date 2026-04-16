---
name: rozenite-agent-sdk
description: Use Rozenite for Agents through `@rozenite/agent-sdk` in Node.js or TypeScript code. Trigger this skill when Codex needs to write or run scripts, wrappers, automations, benchmarks, or agent runtimes that call Rozenite programmatically instead of driving the `rozenite agent` CLI directly.
---

# Rozenite Agent SDK

Use this skill when the user wants code-first access to Rozenite for Agents.

Read `references/code-patterns.md` before writing a new script or when you need a copy-pastable starting point for the default flow, inspecting domains and tools, calling tools by name, typed plugin calls, or session management.

## Rules

- Prefer throwaway Node ESM scripts that import `@rozenite/agent-sdk`.
- Start with the default flow: `createAgentClient()` -> `client.withSession(...)` -> inspect what is available -> call the tool you need.
- Prefer `createAgentClient()` with `client.withSession(...)` by default. It is the happy path and closes the session automatically.
- Use `client.targets.list()` when device selection matters. If more than one target is connected, choose the right `deviceId` and pass it when opening the session.
- Use `session.domains.list()` as the source of truth for the currently available built-in and runtime domains.
- Use `session.tools.list({ domain })` and `session.tools.getSchema({ domain, tool })` when you need to inspect what is available or confirm a tool's arguments.
- Use `session.tools.call(...)` for actual work.
- When the tool is already known by domain and name, make a call by name with `session.tools.call({ domain, tool, args })`.
- Prefer typed plugin SDK descriptors from package `./sdk` exports when available and resolvable from the current package. In that case, prefer `session.tools.call(descriptor, args)` over spelling out domain and tool names manually.
- When you discover tools through `session.tools.list({ domain })`, treat the returned `shortName` as the canonical tool name to pass back into a later call-by-name invocation. Do not invent camelCase aliases or normalize tool names yourself.
- Prefer stable SDK domain identifiers such as built-in domain IDs (`network`, `react`, `memory`) and plugin IDs (`@rozenite/storage-plugin`) over CLI-only live domain tokens like `at-rozenite__storage-plugin`.
- If the current package does not depend on a plugin package that exports `./sdk`, prefer a call by name instead of adding speculative imports.
- If paged results should be merged automatically, use `autoPaginate`.
- If a plugin only mounts after navigation, navigate first, then refresh the live view with `session.domains.list()` or `session.tools.list(...)` before calling the plugin tool.
- Use `client.openSession()` only when the session must span multiple independent steps or function boundaries. Always close it in a `finally` block with `await session.stop()`.
- Use `client.attachSession(sessionId)` only when reconnecting to an already-existing session.
- Do not use `rozenite agent` CLI commands when this skill applies. If the user wants shell-driven live debugging instead of code, switch to `rozenite-agent`.
- If a script encounters an unexpected runtime error, let the script fail clearly. Do not hide the failure by printing placeholder JSON.

## Flow

1. Write or open a small Node ESM script.
2. Import `createAgentClient()` from `@rozenite/agent-sdk`.
3. Start with `client.withSession(...)` unless the session must stay open across separate steps.
4. If multiple devices may be connected, call `client.targets.list()` and pass `deviceId`.
5. Use `session.domains.list()` to confirm what is registered on the live target.
6. If needed, inspect a domain with `session.tools.list({ domain })` or inspect one tool with `session.tools.getSchema({ domain, tool })`.
7. Call the needed tool with `session.tools.call(...)`, either by name or with a typed plugin descriptor.
8. If paged results should be merged, pass `autoPaginate`.
9. If the session must stay open, switch to `client.openSession()` and stop it in `finally`.
10. If reconnecting to an already-existing session, use `client.attachSession(sessionId)`.

## Choosing Calls

- Use a call by name when you know the domain and tool name, or when you discovered them at runtime.
- Use a typed plugin call when a plugin publishes descriptors under `./sdk` and type inference will save effort or reduce mistakes.

## Managing Sessions

- Use `withSession(...)` for almost all short scripts and one-off tasks.
- Use `openSession()` only when the session must stay open across multiple independent steps or function boundaries.
- Use `attachSession(sessionId)` only when reconnecting to an existing session instead of creating a new one.

## Handoff

- If the user asks to inspect the running app through shell commands, reuse a live CLI session, or operate directly with `rozenite agent ...`, use `rozenite-agent` instead.
- If this skill is already active and the task turns into CLI-driven debugging, hand off to `rozenite-agent`.
