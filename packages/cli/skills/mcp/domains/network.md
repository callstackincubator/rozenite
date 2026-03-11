# Network Domain

Use this domain for network-specific tooling only.

## Command Surface
- `rozenite mcp session create --json [--deviceId <id>]`
- `rozenite mcp network list-tools --json --session <id> [--limit <n>] [--cursor <token>] [--fields name,shortName,description] [--verbose]`
- `rozenite mcp network get-tool-schema --tool <name> --json --session <id>`
- `rozenite mcp network call-tool --tool <name> --args '<json>' --json --session <id>`

## Guidance
- Create or select a session first. All network operations are session-scoped.
- Start with `list-tools` to find valid tool names.
- If a specific device is requested, run `rozenite mcp targets --json` first, then create the session with `rozenite mcp session create --deviceId <id> --json`.
- `list-tools` is compact by default (`name`, `shortName`).
- Use `get-tool-schema` before the first invocation.
- Keep arguments minimal and explicit.
- Prefer narrow queries over large payload requests.
