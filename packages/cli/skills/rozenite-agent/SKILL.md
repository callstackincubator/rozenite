---
name: rozenite-agent
description: Skill giving access to React Native Devtools and Rozenite plugins.
---

# Rozenite Skill

## Ground Truths
- Agent work is session-scoped. Reuse one active session across related commands.
- Always check for an existing session first: `rozenite agent session list`
- Create a session only when needed: `rozenite agent session create`
- Pin to a specific device only when explicitly requested:
  1. `rozenite agent targets`
  2. `rozenite agent session create --deviceId <id>`
- Pass `--session <id>` on every domain command.
- Always list domains before acting so you have the up-to-date view for the current session:
  `rozenite agent domains --session <id>`
- Prefer `--limit 20` and cursor pagination for list commands.

## Workflow
1. Ensure there is an Agent session.
2. Run `rozenite agent domains --session <id>`.
3. Pick the domain that matches the task.
4. Read the relevant reference below.
5. Execute `tools`, `schema`, and `call` for that domain.

## Commands
- `rozenite agent session create`
- `rozenite agent <domain> tools --session <id>`
- `rozenite agent <domain> schema -t <name> --session <id>`
- `rozenite agent <domain> call -t <name> -a '<json>' --session <id>`

## Built-in Domains
- `console`: Read, filter, paginate console messages; clear log buffer.
- `network`: Record HTTP/HTTPS traffic; list requests, inspect details/bodies, analyze timing.
- `react`: Search and traverse component tree; read props, state, hooks; record render timelines (profiling).
- `performance`: Start/stop trace, export to file (file-backed).
- `memory`: Heap snapshots and allocation sampling; file-backed exports.

## Dynamic Domains
- Additional domains can appear at runtime when Rozenite plugins are installed in the app.
- These domains are not fixed ahead of time, so always trust `rozenite agent domains --session <id>` over memory.
- Domain entries include metadata such as `id`, `kind`, `pluginId`, `slug`, and `description`.
- Treat entries with `"kind":"plugin"` as dynamic plugin/app domains.

## Learning About Plugins
When you encounter a domain with `"kind":"plugin"` (or any domain you need to use):

1. **Check References below** — If this skill lists a `domains/<name>.md` (or similar) reference that matches the domain (by slug, pluginId, or obvious name), **read that file** and follow it for tools, semantics, and workflow.
2. **No reference file** — If there is no matching reference for that plugin:
   - Run `rozenite agent <domain> tools --session <id>` to get the live tool list.
   - For each tool you plan to call, run `rozenite agent <domain> schema -t <toolName> --session <id>` to learn arguments and return shape.
   - Then run `rozenite agent <domain> call -t <toolName> -a '<json>' --session <id>` as needed.

Always start from `rozenite agent domains --session <id>` to see `description`, `pluginId`, and `slug`; use those to match against the reference filenames or to drive discovery when no reference exists.

## References
- `domains/console.md`
- `domains/network.md`
- `domains/react.md`
- `domains/memory.md`
- `domains/performance.md`
- `domains/react-navigation.md`
- `domains/mmkv.md`
- `domains/tanstack-query.md`
