# Console Domain

Use this domain for CDP-style React Native logs and console message access.

## Command Surface
- `rozenite mcp console tools -j [-n <n>] [-c <token>] [-f name,shortName,description] [-v] [-d <id>]`
- `rozenite mcp console schema -t <name> -j [-d <id>]`
- `rozenite mcp console call -t <name> -a '<json>' -j [-d <id>] [-p <n>] [-m <n>]`

## Guidance
- Start with `list-tools` to confirm the available `Console.*` tools on the connected device.
- Use `get-tool-schema` before first invocation to confirm the latest filter arguments.
- For log reads, prefer `Console.getMessages` with bounded `limit` and continue with returned `cursor`.
- Use `--pages` (or `-p`) only when you intentionally want auto-pagination in one CLI call. `--max-items` (`-m`) requires `--pages`.
- Do not include `--deviceId` unless the user asks for a specific device.
- If a specific device is requested, run `rozenite mcp targets --json` first, then reuse that `--deviceId <id>` for each Console command.
