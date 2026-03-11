---
name: rozenite-agent
description: Skill giving access to React Native Devtools and Rozenite plugins.
---

# Rozenite Skill

## Workflow
1. Ensure there is an Agent session. Start with `rozenite agent session list --json`, then create one with `rozenite agent session create --json` when needed.
2. Discover available domains with the Rozenite CLI for that session (`rozenite agent domains --session <id> --json`).
3. Load only one domain guide at a time.
4. Execute domain commands using `rozenite agent <domain> <action> ... --session <id> --json` (short aliases also work).
5. Prefer `--limit 20` and cursor pagination for list commands.

## Sessions
- Reuse one active session id across related calls; do not create a new session per command.
- Check existing sessions first: `rozenite agent session list --json`
- Create when needed: `rozenite agent session create --json`
- Pin to device only when explicitly requested:
  1. `rozenite agent targets --json`
  2. `rozenite agent session create --deviceId <id> --json`
- Pass session explicitly on every domain command: `--session <id>`

## Command Shape (Required)
- Valid: `rozenite agent session create -j`
- Valid: `rozenite agent <domain> tools -j --session <id>` (alias: `list-tools`)
- Valid: `rozenite agent <domain> schema -t <name> -j --session <id>` (alias: `get-tool-schema`)
- Valid: `rozenite agent <domain> call -t <name> -a '<json>' -j --session <id>` (alias: `call-tool`)
- Invalid: `rozenite agent list-tools --json` (missing `<domain>`)

## Domains
- `console`: CDP-style console/log inspection tools with paged reads.
  Known tools:
  `enable` enables log buffering for the current device.
  `disable` stops log buffering for the current device.
  `clearMessages` clears buffered console messages.
  `getMessages` reads buffered console messages with pagination and optional filters.
- `network`: Raw CDP network recording with paginated request browsing and explicit detail/body tools.
- `react`: React tree inspection and profiling tools.
- `performance`: CDP tracing tools with file-backed exports.
  Known tools:
  `startTrace` starts a performance trace on the current session target.
  `stopTrace` stops the trace and exports it to a file path you provide.
- `memory`: CDP heap and sampling tools with file-backed exports.
- Dynamic plugin domains: discovered at runtime from `list-domains`.

Read domain-specific guidance from:
- `domains/console.md`
- `domains/network.md`
- `domains/react.md`
- `domains/performance.md`
- `domains/memory.md`
- `domains/plugins.md`
