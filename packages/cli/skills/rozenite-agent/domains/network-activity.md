# Network Activity Plugin Domain

A Rozenite plugin for fallback network inspection when the built-in `network` domain is unavailable, such as on older React Native versions. It mirrors the built-in `network` API for HTTP request recording and inspection, and adds plugin-specific tools for WebSocket and SSE traffic.

## Domain
- Plugin ID: `@rozenite/network-activity-plugin`
- Domain token: discovered at runtime via `rozenite agent domains --session <sessionId>`

## Precedence
- Prefer the built-in `network` domain first.
- If `network` is missing from `rozenite agent domains --session <sessionId>`, or it fails to initialize/use for the current app, fall back to this plugin domain.

## HTTP Parity Tools
- `startRecording` -> `{}`
- `stopRecording` -> `{}`
- `getRecordingStatus` -> `{}`
- `listRequests` -> `{}` | `{"cursor":"<cursor>"}` | `{"limit":50}`
- `getRequestDetails` -> `{"requestId":"<requestId>"}`
- `getRequestBody` -> `{"requestId":"<requestId>"}`
- `getResponseBody` -> `{"requestId":"<requestId>"}`

## Realtime Extras
- `listRealtimeConnections` -> `{}` | `{"cursor":"<cursor>"}` | `{"limit":50}`
- `getRealtimeConnectionDetails` -> `{"requestId":"<requestId>"}`

`listRequests` and `getRequestDetails` stay HTTP-focused for fallback compatibility. Use the realtime tools only when you need WebSocket or SSE traffic.

## Minimal Flow
HTTP fallback:
`startRecording` -> reproduce traffic -> `listRequests` -> `getRequestDetails` -> optional body fetch.

Realtime:
`startRecording` -> reproduce traffic -> `listRealtimeConnections` -> `getRealtimeConnectionDetails`.
