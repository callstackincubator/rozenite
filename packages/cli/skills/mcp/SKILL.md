---
name: rozenite
description: Skill giving access to React Native Devtools and Rozenite plugins through progressive domain discovery and JSON-first commands.
---

# Rozenite Skill

## Workflow
1. Ensure there is an MCP session. Start with `rozenite mcp session list --json`, then create one with `rozenite mcp session create --json` when needed.
2. Discover available domains with the Rozenite CLI for that session (`rozenite mcp domains --session <id> --json`).
3. Load only one domain guide at a time.
4. Execute domain commands using `rozenite mcp <domain> <action> ... --session <id> --json` (short aliases also work).
5. Prefer `--limit 20` and cursor pagination for list commands.

## Rules
- MCP commands require an explicit `--session <id>`.
- The CLI is short-lived; the daemon and session carry runtime state across commands.
- If a specific device is required, first list available targets, then create a session pinned to that device with `rozenite mcp session create --deviceId <id> --json`.
- Use the smallest command that answers the current question.
- Avoid broad capability dumps unless needed.
- Treat plugin availability as runtime state, not static documentation.
- Never run bare actions without a domain, e.g. do **not** run `rozenite mcp list-tools --json`.
- `list-tools` is compact by default and intentionally excludes schemas.
- Fetch schemas explicitly with `get-tool-schema` only when needed.
- For `@rozenite/react-navigation-plugin`, prefer high-level tools (`navigate`, `go-back`) before low-level tools (`dispatch-action`, `reset-root`).

## Command Shape (Required)
- Valid: `rozenite mcp session create -j`
- Valid: `rozenite mcp <domain> tools -j --session <id>` (alias: `list-tools`)
- Valid: `rozenite mcp <domain> schema -t <name> -j --session <id>` (alias: `get-tool-schema`)
- Valid: `rozenite mcp <domain> call -t <name> -a '<json>' -j --session <id>` (alias: `call-tool`)
- Invalid: `rozenite mcp list-tools --json` (missing `<domain>`)

## Domains
- `console`: CDP-style console/log inspection tools with paged reads.
- Dynamic plugin domains: discovered at runtime from `list-domains`.

Read domain-specific guidance from:
- `domains/console.md`
- `domains/network.md`
- `domains/react.md`
- `domains/plugins.md`
