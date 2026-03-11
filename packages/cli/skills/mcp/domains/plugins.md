# Plugin Domains

Use runtime plugin domains for app-defined or plugin-defined MCP tools.

## Discovery
- Run `rozenite mcp session create --json [--deviceId <id>]` if you do not already have a session.
- Run `rozenite mcp list-domains --session <id> --json`.
- Select an entry where `kind` is `plugin`.
- Use the returned `id` as `<pluginDomain>`.

## Command Surface
- `rozenite mcp <pluginDomain> list-tools --json --session <id> [--limit <n>] [--cursor <token>] [--fields name,shortName,description] [--verbose]`
- `rozenite mcp <pluginDomain> get-tool-schema --tool <name> --json --session <id>`
- `rozenite mcp <pluginDomain> call-tool --tool <name> --args '<json>' --json --session <id>`
- `rozenite mcp load-domain <pluginDomain> --json --session <id>`

## Guidance
- Always discover plugin domains at runtime.
- All plugin-domain operations are session-scoped.
- If a specific device is requested, run `rozenite mcp targets --json` first, then create the session with `rozenite mcp session create --deviceId <id> --json`.
- Start `list-tools` with `--limit 20` and continue via returned cursor.
- Call `get-tool-schema` before first invocation.
- `--tool` accepts full names and short names; use full name when short name is ambiguous.
- Prefer narrow, schema-compliant arguments to reduce output size.

## React Navigation Plugin Priority
For `@rozenite/react-navigation-plugin` tools, prefer high-level navigation calls first:
- First choice: `navigate`, `go-back`.
- Read/inspect as needed: `get-focused-route`, `get-root-state`, `list-actions`.
- Low-level fallback only when needed: `dispatch-action`, `reset-root`.
- Use `open-link` for deep-link specific flows, not general route switching.
