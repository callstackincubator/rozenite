# React Domain

Use this domain for React tree inspection, inspected component data, and profiling.

## Command Surface
- `rozenite agent session create -j [--deviceId <id>]`
- `rozenite agent react tools -j --session <id> [-n <n>] [-c <token>] [-f name,shortName,description] [-v]`
- `rozenite agent react schema -t <name> -j --session <id>`
- `rozenite agent react call -t <name> -a '<json>' -j --session <id>`

## Guidance
- Create or select a session first. All React inspection state is session-scoped.
- Begin with `list-tools` to enumerate available React operations.
- Use `searchNodes` to find candidate node IDs.
- Use `getNode` and `getChildren` to navigate structure incrementally.
- Use `getProps`, `getState`, and `getHooks` for inspected snapshots.
- For nested hook inspection, call `getHooks` with `path` (e.g. `[0, "subHooks", 1]`).
- Use `startProfiling` to begin profiling (`{"shouldRestart":true}` if reload-and-profile is required and supported).
- Use `isProfilingStarted` to check status before/after profiling actions.
- Use `stopProfiling` for a compact session summary (`waitForDataMs` and `slowRenderThresholdMs` are optional).
- Use `getRenderData` for one commit at a time with `rootId` + `commitIndex`; always prefer pagination (`limit` + `cursor`) to keep payload size bounded.
- If a specific device is requested, run `rozenite agent targets --json` first, then create the session with `rozenite agent session create --deviceId <id> --json`.
- `list-tools` is compact by default (`name`, `shortName`).
- Read schemas before calling tools with deep or nested arguments.
- Use scoped calls to avoid large responses.

## Profiling Flow (Recommended)
1. `startProfiling` with `{"shouldRestart":false}` (or `true` if reload-and-profile is needed).
2. Trigger the user action to profile.
3. `stopProfiling` to get compact summary of commits and slow renders.
4. Inspect specific commits with `getRenderData` and paged reads.

## Example Calls
- `rozenite agent react call -t startProfiling -a '{"shouldRestart":false}' -j --session <id>`
- `rozenite agent react call -t isProfilingStarted -a '{}' -j --session <id>`
- `rozenite agent react call -t stopProfiling -a '{"waitForDataMs":3000,"slowRenderThresholdMs":16}' -j --session <id>`
- `rozenite agent react call -t getRenderData -a '{"rootId":1,"commitIndex":0,"limit":20}' -j --session <id>`
