# Network Domain

Use this domain for network-specific tooling only.

## Command Surface
- `rozenite mcp network list-tools --json [--limit <n>] [--cursor <token>] [--fields name,shortName,description] [--verbose] [--deviceId <id>]`
- `rozenite mcp network get-tool-schema --tool <name> --json [--deviceId <id>]`
- `rozenite mcp network call-tool --tool <name> --args '<json>' --json [--deviceId <id>]`

## Guidance
- Start with `list-tools` to find valid tool names.
- Do not include `--deviceId` unless the user asks for a particular device.
- If a specific device is requested, run `rozenite mcp targets --json` first, then reuse that `--deviceId <id>` for each Network command.
- `list-tools` is compact by default (`name`, `shortName`).
- Use `get-tool-schema` before the first invocation.
- Keep arguments minimal and explicit.
- Prefer narrow queries over large payload requests.
