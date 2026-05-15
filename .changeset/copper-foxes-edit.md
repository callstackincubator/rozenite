---
'@rozenite/storage-plugin': minor
---

Add a hex-first UI for binary (`buffer`) storage entries.

The table cell now shows a short hex preview plus byte count, the detail dialog renders a standard hexdump with offsets and ASCII column, and the add/edit dialogs replace the JSON array textarea with a CodeMirror editor. The editor offers Hex (default) and Base64 modes, normalizes pasted content (raw hex, grouped hex, multiline hex, hexdump rows with offsets/ASCII columns) immediately, and surfaces byte count, ASCII preview, and validation errors below the input. The internal protocol is unchanged: `buffer` values still flow through the existing `number[]` write path.