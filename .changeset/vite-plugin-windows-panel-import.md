---
'@rozenite/vite-plugin': patch
---

Fix building plugin panels on Windows, which failed with "Bad character escape
sequence" because the generated panel entry imported its source with
backslashes.
