# Console Domain

Use this domain for CDP-style React Native logs and console message access.

## Command Surface
- `rozenite mcp console list-tools --json [--limit <n>] [--cursor <token>] [--fields name,shortName,description] [--verbose] [--deviceId <id>]`
- `rozenite mcp console get-tool-schema --tool <name> --json [--deviceId <id>]`
- `rozenite mcp console call-tool --tool <name> --args '<json>' --json [--deviceId <id>] [--pages <n>] [--max-items <n>]`

## Guidance
- Start with `list-tools` to confirm the available `Console.*` tools on the connected device.
- Use `get-tool-schema` before first invocation to confirm the latest filter arguments.
- For log reads, prefer `Console.getMessages` with bounded `limit` and continue with returned `cursor`.
- Use `--pages` and `--max-items` only when you intentionally want auto-pagination in one CLI call.
- Do not include `--deviceId` unless the user asks for a specific device.
- If a specific device is requested, run `rozenite mcp targets --json` first, then reuse that `--deviceId <id>` for each Console command.
