---
'@rozenite/network-activity-plugin': patch
---

Rozenite now treats `application/*+json` responses as JSON in Network Activity, so vendor-specific JSON payloads render correctly instead of falling back to plain text.
