# Performance Domain

Use this domain for CDP trace capture on the current Agent session target.

## Command Surface
- `rozenite agent session create -j [--deviceId <id>]`
- `rozenite agent performance tools -j --session <id> [-n <n>] [-c <token>] [-f name,shortName,description] [-v]`
- `rozenite agent performance schema -t <name> -j --session <id>`
- `rozenite agent performance call -t <name> -a '<json>' -j --session <id>`

## Guidance
- Create or select a session first. Performance operations are session-scoped.
- Known tools:
  `startTrace` begins a performance trace.
  `stopTrace` ends the trace and writes it to a file-backed export.
- Use the known tools directly; use `list-tools` only if the runtime inventory is unclear.
- Use `startTrace` to begin recording.
- Reproduce the issue while the trace is running.
- Use `stopTrace` with `filePath` to export the trace.
- Trace exports are file-backed and return metadata only.
- If a specific device is requested, run `rozenite agent targets --json` first, then create the session with `rozenite agent session create --deviceId <id> --json`.
