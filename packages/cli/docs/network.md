---
name: network
description: Record HTTP/HTTPS traffic, then list requests, inspect request/response details and bodies, and analyze timing.
domain: network
platforms: react-native
---

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

The `agent network tools` discovery listing and `listRequests` use columnar
`cols` and `rows` output at two or more rows. `recording` metadata remains
present, and `next` replaces the page envelope when another page is available.

`listRequests` returns a trimmed default column set (`requestId`, `method`,
`url`, `status`, `durationMs`, `outcome`). Pass `--fields` or `--verbose` for
the remaining fields such as `type`, `startTimeMs`, `endTimeMs`,
`transferSize`, and `encodedDataLength`.

## Platform availability

React Native only. Lynx registers no CDP `Network` domain at all, so this
domain is reported `unsupported` on a Lynx session and every tool here
fails. Use `@rozenite/network-activity-plugin` there — it is the same
fallback the precedence rule above already names.
