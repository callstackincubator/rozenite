# Network Domain

Record HTTP/HTTPS traffic, then list requests, inspect request/response details and bodies, and analyze timing—similar to the browser DevTools Network panel.

## Tools
- `startRecording` -> `{}`
- `stopRecording` -> `{}`
- `getRecordingStatus` -> `{}`
- `listRequests` -> `{}` | `{"cursor":"<cursor>"}` | `{"limit":50}`
- `getRequestDetails` -> `{"requestId":"<requestId>"}`
- `getRequestBody` -> `{"requestId":"<requestId>"}`
- `getResponseBody` -> `{"requestId":"<requestId>"}`

## Minimal Flow
`startRecording` -> reproduce traffic -> `listRequests` -> `getRequestDetails` -> optional body fetch.
