---
name: rozenite
description: Skill giving access to React Native Devtools and Rozenite plugins through progressive domain discovery and JSON-first commands.
---

# Rozenite Skill

## Workflow
1. Discover available domains with the Rozenite CLI (`--json`).
2. Load only one domain guide at a time.
3. Execute domain commands using the exact shape `rozenite mcp <domain> <action> ... --json`.
4. Prefer `--limit 20` and cursor pagination for list commands.

## Rules
- Do not pass `--deviceId` unless the user explicitly asks for a specific device.
- If a specific device is required, first list available targets, then pass the same `--deviceId <id>` on every relevant command in that sequence.
- Use the smallest command that answers the current question.
- Avoid broad capability dumps unless needed.
- Treat plugin availability as runtime state, not static documentation.
- Never run bare actions without a domain, e.g. do **not** run `rozenite mcp list-tools --json`.
- `list-tools` is compact by default and intentionally excludes schemas.
- Fetch schemas explicitly with `get-tool-schema` only when needed.
- For `@rozenite/react-navigation-plugin`, prefer high-level tools (`navigate`, `go-back`) before low-level tools (`dispatch-action`, `reset-root`).

## Command Shape (Required)
- Valid: `rozenite mcp <domain> list-tools --json`
- Valid: `rozenite mcp <domain> get-tool-schema --tool <name> --json`
- Valid: `rozenite mcp <domain> call-tool --tool <name> --args '<json>' --json`
- Invalid: `rozenite mcp list-tools --json` (missing `<domain>`)

## Domains
- `console`: CDP-style console/log inspection tools with paged reads.
- `network`: network-related inspection tools.
- `react`: React Native Devtools tree and component inspection tools.
- Dynamic plugin domains: discovered at runtime from `list-domains`.

Read domain-specific guidance from:
- `domains/console.md`
- `domains/network.md`
- `domains/react.md`
- `domains/plugins.md`
