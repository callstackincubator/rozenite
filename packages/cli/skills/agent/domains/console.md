# Console Domain

Use this domain for CDP-style React Native logs and console message access.

## Command Surface
- `rozenite agent session create -j [--deviceId <id>]`
- `rozenite agent console tools -j --session <id> [-n <n>] [-c <token>] [-f name,shortName,description] [-v]`
- `rozenite agent console schema -t <name> -j --session <id>`
- `rozenite agent console call -t <name> -a '<json>' -j --session <id> [-p <n>] [-m <n>]`

## Guidance
- Create or select a session first. All console reads are session-scoped.
- Known tools:
  `Console.enable` enables buffering.
  `Console.disable` disables buffering.
  `Console.clearMessages` clears buffered logs.
  `Console.getMessages` returns paginated logs with filters.
- Call the known `Console.*` tools directly when they match the task; use `list-tools` only if the runtime inventory appears inconsistent.
- Use `get-tool-schema` before first invocation to confirm the latest filter arguments.
- For log reads, prefer `Console.getMessages` with bounded `limit` and continue with returned `cursor`.
- Use `--pages` (or `-p`) only when you intentionally want auto-pagination in one CLI call. `--max-items` (`-m`) requires `--pages`.
- If a specific device is requested, run `rozenite agent targets --json` first, then create the session with `rozenite agent session create --deviceId <id> --json`.
