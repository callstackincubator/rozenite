Record HTTP/HTTPS traffic, then list requests, inspect request and response details and bodies, and analyze timing, similar to the browser DevTools Network panel.

## Precedence

- Prefer this built-in `network` domain when available.
- If `network` is missing from `rozenite agent domains --session <sessionId>` or fails to initialize or work for the current app, fall back to `@rozenite/network-activity-plugin`.

## Tools

- `startRecording` -> `{}`
- `stopRecording` -> `{}`
- `getRecordingStatus` -> `{}`
- `listRequests` -> `{}` | `{"cursor":"<cursor>"}` | `{"limit":50}`
- `getRequestDetails` -> `{"requestId":"<requestId>"}`
- `getRequestBody` -> `{"requestId":"<requestId>"}`
- `getResponseBody` -> `{"requestId":"<requestId>"}`

## Flow

`startRecording` -> reproduce traffic -> `listRequests` -> `getRequestDetails` -> optional body fetch.
