---
'@rozenite/network-activity-plugin': minor
---

Add a toolbar export button that downloads the current network activity session as a JSON file.

The export includes HTTP requests, WebSocket connections, SSE streams, and realtime messages captured during the session, along with a summary (entry counts by type) and metadata (`schemaVersion`, `exportedAt`).
