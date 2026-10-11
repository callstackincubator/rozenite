---
name: network-activity
description: Fallback HTTP, WebSocket, and SSE network inspection via the Network Activity plugin when the built-in network domain is unavailable.
domain: network-activity
---

# Network Activity Plugin Domain

A Rozenite plugin for fallback network inspection when the built-in `network` domain is unavailable, such as on older React Native versions. It mirrors the built-in `network` API for HTTP request recording and inspection, and adds plugin-specific tools for WebSocket and SSE traffic.

## Domain

- Plugin ID: `@rozenite/network-activity-plugin`
- Domain token: `network-activity`

## Precedence

- Prefer the built-in `network` domain first.
- If `network` is missing from `npx rozenite agent domains`, or it fails to initialize or work for the current app, fall back to this plugin domain.

## HTTP Parity Tools

```
npx rozenite agent network-activity startRecording
npx rozenite agent network-activity stopRecording
npx rozenite agent network-activity getRecordingStatus
npx rozenite agent network-activity listRequests
npx rozenite agent network-activity getRequestDetails --requestId <requestId>
npx rozenite agent network-activity getRequestBody --requestId <requestId>
npx rozenite agent network-activity getResponseBody --requestId <requestId>
npx rozenite agent network-activity getResponseBody --requestId <requestId> --offset 16384 --maxBytes 65536
```

## Realtime Extras

```
npx rozenite agent network-activity listRealtimeConnections
npx rozenite agent network-activity getRealtimeConnectionDetails --requestId <requestId>
```

`listRequests` and `getRequestDetails` stay HTTP-focused for fallback compatibility. Use the realtime tools only when you need WebSocket or SSE traffic.

## Lists

`listRequests` and `listRealtimeConnections` return the newest 20 rows per page (`--limit` up to 100). When more rows exist the output ends with a `next` command; run it to continue. Paging resumes after the last request returned, so traffic captured while you page does not shift the next page. If that request was evicted from the buffer, or a new recording started, the page comes back empty with `reset: true`: list again without `--cursor`. Recording state and buffer counters are one `getRecordingStatus` away.

Rows show identifiers, status and duration by default. Pass `--fields` with column names, or `--fields all`, for more.

## Bodies

`getRequestBody` and `getResponseBody` return at most 16384 bytes, starting at `--offset` (default 0). The result reports `totalBytes` and `truncated`; to read on, call again with `--offset` set to the previous offset plus the bytes returned. `--maxBytes` changes the range size. For a `base64Encoded` body, offsets count base64 characters.

## Minimal Flow

HTTP fallback:
`startRecording` -> reproduce traffic -> `listRequests` -> `getRequestDetails` -> optional body fetch.

Realtime:
`startRecording` -> reproduce traffic -> `listRealtimeConnections` -> `getRealtimeConnectionDetails`.
