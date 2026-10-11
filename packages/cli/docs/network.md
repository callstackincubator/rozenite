---
name: network
description: Record HTTP/HTTPS traffic, then list requests, inspect request/response details and bodies, and analyze timing.
domain: network
integrations: react-native
---

Record HTTP/HTTPS traffic, then list requests, inspect request and response details and bodies, and analyze timing, similar to the browser DevTools Network panel.

## Precedence

- Prefer this built-in `network` domain when available.
- If `network` is missing from `npx rozenite agent domains` or fails to initialize or work for the current app, fall back to `@rozenite/network-activity-plugin`.

## Tools

```sh
npx rozenite agent network startRecording
npx rozenite agent network stopRecording
npx rozenite agent network getRecordingStatus
npx rozenite agent network listRequests
npx rozenite agent network listRequests --limit 50 --fields requestId,url,transferSize
npx rozenite agent network getRequestDetails --requestId <requestId>
npx rozenite agent network getRequestDetails --requestId <requestId> --include headers,timing,initiator
npx rozenite agent network getRequestBody --requestId <requestId>
npx rozenite agent network getResponseBody --requestId <requestId>
npx rozenite agent network getResponseBody --requestId <requestId> --offset 16384 --maxBytes 65536
```

## Flow

`startRecording` -> reproduce traffic -> `listRequests` -> `getRequestDetails`
-> optional body fetch.

`listRequests` rows default to `requestId`, `method`, `url`, `status`,
`durationMs` and `outcome`. Pass `--fields` for `type`, `startTimeMs`,
`endTimeMs`, `transferSize` and `encodedDataLength`, or `--fields all`. A page
prints only its rows; recording state (whether recording is on, how many
requests were captured or evicted) comes from `getRecordingStatus`.

## Request details

`getRequestDetails` returns the request and response metadata (method, URL,
status, MIME type, `startTimeMs` / `endTimeMs` / `durationMs`, whether it
finished or failed) plus headers. Keys with no value are left out. Everything else is opt-in through `--include`,
which replaces the default `headers`:

- `headers`: request and response headers, including the extra headers the
  network stack added.
- `timing`: the detailed `response.timing` breakdown.
- `initiator`: the full initiator, including its stack trace. Without it,
  `initiator` carries only its `type`.
- `cookies`: cookies sent with the request and cookies the response had
  blocked.
- `redirectChain`: the redirects that led to this request.

## Bodies

`getRequestBody` and `getResponseBody` return the first 16 KB of the body by
default. The result says how big the whole body is (`totalBytes`) and whether
more remains (`truncated`); when it does, `nextOffset` is where the next slice
starts. Read the rest with `--offset <nextOffset>`, and raise `--maxBytes` to
take more at once.

Text bodies the app sent base64-encoded are decoded first (`decoded: true`),
and byte counts then refer to the decoded text. Other base64 bodies stay
encoded, and byte counts refer to the base64 string.

## Platform availability

React Native only. Lynx registers no CDP `Network` domain at all, so this
domain is reported `unsupported` on a Lynx session and every tool here
fails. Use `@rozenite/network-activity-plugin` there. It is the same
fallback the precedence rule above already names.
