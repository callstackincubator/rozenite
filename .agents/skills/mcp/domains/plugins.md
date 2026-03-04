# Plugin Domains

Use runtime plugin domains for app-defined or plugin-defined MCP tools.

## Discovery
- Run `rozenite mcp list-domains --json [--deviceId <id>]`.
- Select an entry where `kind` is `plugin`.
- Use the returned `id` as `<pluginDomain>`.

## Command Surface
- `rozenite mcp <pluginDomain> list-tools --json [--limit <n>] [--cursor <token>] [--fields name,shortName,description] [--verbose] [--deviceId <id>]`
- `rozenite mcp <pluginDomain> get-tool-schema --tool <name> --json [--deviceId <id>]`
- `rozenite mcp <pluginDomain> call-tool --tool <name> --args '<json>' --json [--deviceId <id>]`
- `rozenite mcp load-domain <pluginDomain> --json [--deviceId <id>]`

## Guidance
- Always discover plugin domains at runtime.
- Do not include `--deviceId` unless the user asks for a particular device.
- If a specific device is requested, run `rozenite mcp targets --json` first, then pass the same `--deviceId <id>` to each plugin-domain command in that workflow.
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
