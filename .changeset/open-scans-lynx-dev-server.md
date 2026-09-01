---
'rozenite': minor
---

`rozenite open` now finds Lynx devices too. Without `--port`, it queries the
default port of every supported integration — Metro's `8081` and the Lynx dev
server's `3000` — and offers everything it finds in one picker, labelling each
target with the integration it belongs to. A port that is not listening is
skipped, and the selected target is opened on the dev server it was found on.
Passing `--port` still queries that one port only.
