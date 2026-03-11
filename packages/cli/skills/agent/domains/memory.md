# Memory Domain

Use this domain for CDP heap snapshots and allocation sampling on the current Agent session target.

## Command Surface
- `rozenite agent session create -j [--deviceId <id>]`
- `rozenite agent memory tools -j --session <id> [-n <n>] [-c <token>] [-f name,shortName,description] [-v]`
- `rozenite agent memory schema -t <name> -j --session <id>`
- `rozenite agent memory call -t <name> -a '<json>' -j --session <id>`

## Guidance
- Create or select a session first. Memory operations are session-scoped.
- Use `takeHeapSnapshot` with `filePath` for one-shot heap captures.
- Use `startSampling` before reproducing the issue.
- Use `stopSampling` with `filePath` to export the sampling profile.
- Memory exports are file-backed and return metadata only.
- If a specific device is requested, run `rozenite agent targets --json` first, then create the session with `rozenite agent session create --deviceId <id> --json`.
