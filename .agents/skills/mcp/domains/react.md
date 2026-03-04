# React Domain

Use this domain for React tree and component inspection.

## Command Surface
- `rozenite mcp react list-tools --json [--limit <n>] [--cursor <token>] [--fields name,shortName,description] [--verbose] [--deviceId <id>]`
- `rozenite mcp react get-tool-schema --tool <name> --json [--deviceId <id>]`
- `rozenite mcp react call-tool --tool <name> --args '<json>' --json [--deviceId <id>]`

## Guidance
- Begin with `list-tools` to enumerate available React operations.
- Use `React.searchNodes` to find candidate node IDs.
- Use `React.getNode` and `React.getChildren` to navigate structure incrementally.
- Use `React.getProps`, `React.getState`, and `React.getHooks` for inspected snapshots.
- For nested hook inspection, call `React.getHooks` with `path` (e.g. `[0, "subHooks", 1]`).
- Do not include `--deviceId` unless the user asks for a particular device.
- If a specific device is requested, run `rozenite mcp targets --json` first, then reuse that `--deviceId <id>` for each React command.
- `list-tools` is compact by default (`name`, `shortName`).
- Read schemas before calling tools with deep or nested arguments.
- Use scoped calls to avoid large responses.
