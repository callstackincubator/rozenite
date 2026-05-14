---
'@rozenite/network-activity-plugin': minor
---

Image responses now render inline in the Network Activity panel. PNG, JPEG, GIF, WebP, and SVG show up as previews under a new Preview/Raw sub-tab. The Raw tab shows Content-Type and decoded size; for SVG, the Raw tab shows the source XML. Image responses above an in-capture 5 MB cap show a "Response too large for preview" message instead of crossing the bridge.

Adds a Preview/Raw axis that subsequent response-viewer improvements (rendered HTML, formatted XML, JSON Raw, ...) will extend. The toggle is adaptive — hidden for formats with only one meaningful view. The user's last toggle choice sticks across responses within a panel session.

The `response-body` bridge event's wire shape is extended additively to a discriminated union (`string | { kind: 'binary'; base64 } | { kind: 'binary-too-large'; size } | null`). Existing consumers that only handle the string variant continue to work unchanged.