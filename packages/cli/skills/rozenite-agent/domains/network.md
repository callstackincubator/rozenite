# Network Domain

Use this domain for raw CDP network recording and request inspection.

## Command Surface
- `rozenite agent session create --json [--deviceId <id>]`
- `rozenite agent network list-tools --json --session <id> [--limit <n>] [--cursor <token>] [--fields name,shortName,description] [--verbose]`
- `rozenite agent network get-tool-schema --tool <name> --json --session <id>`
- `rozenite agent network call-tool --tool <name> --args '<json>' --json --session <id>`

## Guidance
- Create or select a session first. All network operations are session-scoped.
- Known tools:
  `startRecording` starts a fresh capture buffer.
  `stopRecording` ends the active capture.
  `getRecordingStatus` reports whether capture is running.
  `listRequests` pages through captured request summaries.
  `getRequestDetails` returns metadata, headers, and timing for one request.
  `getRequestBody` returns request body content for one request.
  `getResponseBody` returns response body content for one request.
- Use the known tools directly; fall back to `list-tools` only if the runtime inventory is unclear.
- Start with `startRecording`, then reproduce the network activity you want.
- Use `listRequests` to page through compact summaries.
- Use `getRequestDetails` for headers/timing/metadata on one request.
- Use `getRequestBody` or `getResponseBody` only when you explicitly need body content.
- Starting a new recording clears the previously captured request buffer.
- If a specific device is requested, run `rozenite agent targets --json` first, then create the session with `rozenite agent session create --deviceId <id> --json`.
- Use `get-tool-schema` before the first invocation.
- Keep arguments minimal and explicit.
- Prefer narrow request inspection over broad body fetches.
