---
"@rozenite/middleware": patch
---

`getResponseBody` now counts `offset`, `maxBytes`, `totalBytes` and `nextOffset` in decoded bytes for bodies that stay base64-encoded (binary content), and re-encodes the returned window. Previously they counted base64 characters, so a 64-character window reported `nextOffset: 64` while holding 48 bytes.
