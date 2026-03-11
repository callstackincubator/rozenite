# React Domain

Use this domain for React tree inspection, inspected component data, and profiling.

## Command Surface
- `rozenite mcp session create -j [--deviceId <id>]`
- `rozenite mcp react tools -j --session <id> [-n <n>] [-c <token>] [-f name,shortName,description] [-v]`
- `rozenite mcp react schema -t <name> -j --session <id>`
- `rozenite mcp react call -t <name> -a '<json>' -j --session <id>`

## Guidance
- Create or select a session first. All React inspection state is session-scoped.
- Begin with `list-tools` to enumerate available React operations.
- Use `React.searchNodes` to find candidate node IDs.
- Use `React.getNode` and `React.getChildren` to navigate structure incrementally.
- Use `React.getProps`, `React.getState`, and `React.getHooks` for inspected snapshots.
- For nested hook inspection, call `React.getHooks` with `path` (e.g. `[0, "subHooks", 1]`).
- Use `React.startProfiling` to begin profiling (`{"shouldRestart":true}` if reload-and-profile is required and supported).
- Use `React.isProfilingStarted` to check status before/after profiling actions.
- Use `React.stopProfiling` for a compact session summary (`waitForDataMs` and `slowRenderThresholdMs` are optional).
- Use `React.getRenderData` for one commit at a time with `rootId` + `commitIndex`; always prefer pagination (`limit` + `cursor`) to keep payload size bounded.
- If a specific device is requested, run `rozenite mcp targets --json` first, then create the session with `rozenite mcp session create --deviceId <id> --json`.
- `list-tools` is compact by default (`name`, `shortName`).
- Read schemas before calling tools with deep or nested arguments.
- Use scoped calls to avoid large responses.

## Profiling Flow (Recommended)
1. `React.startProfiling` with `{"shouldRestart":false}` (or `true` if reload-and-profile is needed).
2. Trigger the user action to profile.
3. `React.stopProfiling` to get compact summary of commits and slow renders.
4. Inspect specific commits with `React.getRenderData` and paged reads.

## Example Calls
- `rozenite mcp react call -t React.startProfiling -a '{"shouldRestart":false}' -j --session <id>`
- `rozenite mcp react call -t React.isProfilingStarted -a '{}' -j --session <id>`
- `rozenite mcp react call -t React.stopProfiling -a '{"waitForDataMs":3000,"slowRenderThresholdMs":16}' -j --session <id>`
- `rozenite mcp react call -t React.getRenderData -a '{"rootId":1,"commitIndex":0,"limit":20}' -j --session <id>`
