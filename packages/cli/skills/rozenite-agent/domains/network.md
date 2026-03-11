# Network Domain

CDP network capture + request inspection.

## Call Format
- `rozenite agent network call-tool --session <sessionId> --tool <tool> --args '<json>' --json`

## Tools (required args only)
- `startRecording` -> `{}`
- `stopRecording` -> `{}`
- `getRecordingStatus` -> `{}`
- `listRequests` -> `{}` | `{"cursor":"<cursor>"}` | `{"limit":50}`
- `getRequestDetails` -> `{"requestId":"<requestId>"}`
- `getRequestBody` -> `{"requestId":"<requestId>"}`
- `getResponseBody` -> `{"requestId":"<requestId>"}`

## Minimal Flow
`startRecording` -> reproduce traffic -> `listRequests` -> `getRequestDetails` -> optional body fetch.
