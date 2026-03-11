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

## Rules
- Agent commands require an explicit `--session <id>`.
- The CLI is short-lived; the daemon and session carry runtime state across commands.
- Agent daemon/session runtime code should use plain types plus factory functions, not classes.
- If a specific device is required, first list available targets, then create a session pinned to that device with `rozenite agent session create --deviceId <id> --json`.
- Use the smallest command that answers the current question.
- Avoid broad capability dumps unless needed.
- Treat plugin availability as runtime state, not static documentation.
- Never run bare actions without a domain, e.g. do **not** run `rozenite agent list-tools --json`.
- For `console`, `network`, and `performance`, prefer the known tool inventory below before calling `list-tools`.
- `list-tools` is compact by default and intentionally excludes schemas.
- Fetch schemas explicitly with `get-tool-schema` only when needed.
- For `@rozenite/react-navigation-plugin`, prefer high-level tools (`navigate`, `go-back`) before low-level tools (`dispatch-action`, `reset-root`).

## Command Shape (Required)
- Valid: `rozenite agent session create -j`
- Valid: `rozenite agent <domain> tools -j --session <id>` (alias: `list-tools`)
- Valid: `rozenite agent <domain> schema -t <name> -j --session <id>` (alias: `get-tool-schema`)
- Valid: `rozenite agent <domain> call -t <name> -a '<json>' -j --session <id>` (alias: `call-tool`)
- Invalid: `rozenite agent list-tools --json` (missing `<domain>`)

## Domains
- `console`: CDP-style console/log inspection tools with paged reads.
  Known tools:
  `Console.enable` enables log buffering for the current device.
  `Console.disable` stops log buffering for the current device.
  `Console.clearMessages` clears buffered console messages.
  `Console.getMessages` reads buffered console messages with pagination and optional filters.
- `network`: Raw CDP network recording with paginated request browsing and explicit detail/body tools.
  Known tools:
  `startRecording` starts a fresh capture and resets the previous request buffer.
  `stopRecording` stops the active network capture window.
  `getRecordingStatus` reports whether recording is currently active.
  `listRequests` lists captured requests with pagination and compact summaries.
  `getRequestDetails` returns headers, timing, and metadata for one request.
  `getRequestBody` returns the captured request body for one request.
  `getResponseBody` returns the captured response body for one request.
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
