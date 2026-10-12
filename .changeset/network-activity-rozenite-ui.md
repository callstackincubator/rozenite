---
'@rozenite/network-activity-plugin': minor
---

The Network Activity panel is rebuilt on `@rozenite/ui`, so it follows the DevTools
light and dark themes instead of always rendering dark. Every feature stays: the
request list with filters, sorting and selection, the timeline, the side panel with
headers, request and response bodies, cookies, initiator, timing and WebSocket and
SSE messages, response overrides, and copying a request as cURL or `fetch`. The
side panel is now resizable, the list shows an empty state, rows can be picked with
the keyboard, and failed requests read as errors. The Timing tab now shows the
request's real start and end times.
