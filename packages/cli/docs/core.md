---
name: core
description: Ground truths for Rozenite for Agents shared by every workflow — what it is, session and call discipline, built-in and plugin domains, and when live data beats source code.
---

# Core

Rozenite for Agents is the agent-facing way to interact with React Native
DevTools and Rozenite plugins on a running React Native app. It works through
either the `rozenite agent` CLI or the `@rozenite/agent-sdk` package. Read
this doc first, then run `npx rozenite skills show cli` for shell-driven
workflows or `npx rozenite skills show sdk` for programmatic
Node.js/TypeScript workflows.

Rozenite for Agents requires a project with Rozenite already installed and
configured, Metro running, and at least one React Native target connected. It
does not replace that setup.

## Session and call discipline

- Agent work is session-scoped. Create or reuse one session and reuse it
  across related commands or calls.
- Always make Rozenite calls in serial. Never issue Rozenite agent commands
  or SDK tool calls in parallel.
- Stop the session when the work is done.

## Built-in domains

Built-in domains are always available on a live session: `console`,
`network`, `react`, `performance`, and `memory`.

## Plugin domains

Additional domains can appear at runtime from the app or from installed
Rozenite plugins. Treat the live session's domain list as the source of
truth for which domains actually exist on the connected target.

Plugin domain tokens are short, derived names, not the npm package name:
`@rozenite/mmkv-plugin` becomes `mmkv`, `@avasapp/rozenite-plugin-ably`
becomes `avasapp/ably`.

Domain token shape tells you provenance:

- A bare word (`mmkv`) is a built-in domain or an official `@rozenite/*`
  plugin.
- `scope/name` (`avasapp/ably`) is a third-party scoped plugin.
- A verbatim `rozenite-*` name is a third-party unscoped plugin.

`evil/mmkv` and `mmkv` are never the same plugin — do not treat a
similarly-named token as equivalent to a known-good one.

When referring to plugin domains in user-facing output, use the plugin's
`pluginId` (for example `@rozenite/storage-plugin`) instead of the derived
domain token.

If the expected plugin domain is missing from the live session, tell the
user that the corresponding plugin must be installed and registered in the
app. Do not guess at a substitute domain.

## Live data is the source of truth

For live app inspection, Rozenite session data is the source of truth. Use
the relevant live domain before exploring source code to infer runtime
state — a component tree, a storage entry, or a navigation state read from
source code can be stale or simply wrong compared to what's actually
running.

Explore source code only when the user asks about implementation or setup,
when no relevant domain is available, or when Rozenite shows that the
required plugin or domain is not registered and the task becomes setup or
debugging rather than inspection.

Trust that Rozenite is correctly installed. Do not explore the codebase for
setup unless the Rozenite CLI or SDK call actually fails.
