# Console Domain

Use this domain for CDP-style React Native logs and console message access.

## Command Surface
- `rozenite mcp session create -j [--deviceId <id>]`
- `rozenite mcp console tools -j --session <id> [-n <n>] [-c <token>] [-f name,shortName,description] [-v]`
- `rozenite mcp console schema -t <name> -j --session <id>`
- `rozenite mcp console call -t <name> -a '<json>' -j --session <id> [-p <n>] [-m <n>]`

## Guidance
- Create or select a session first. All console reads are session-scoped.
- Start with `list-tools` to confirm the available `Console.*` tools on the connected device.
- Use `get-tool-schema` before first invocation to confirm the latest filter arguments.
- For log reads, prefer `Console.getMessages` with bounded `limit` and continue with returned `cursor`.
- Use `--pages` (or `-p`) only when you intentionally want auto-pagination in one CLI call. `--max-items` (`-m`) requires `--pages`.
- If a specific device is requested, run `rozenite mcp targets --json` first, then create the session with `rozenite mcp session create --deviceId <id> --json`.
