---
'@rozenite/file-system-plugin': minor
---

Rebuild the File System DevTools panel on `@rozenite/ui`: a sidebar shows a persistent, lazily-loaded directory tree per root, the content pane lists the selected directory's entries in a sortable table with a per-row export action, and a detail pane shows a sticky path bar with copy-to-clipboard and export, a collapsible metadata card, and the image/text preview — all in one scroll region. Importing a file now confirms overwrites with a themed dialog instead of a native browser prompt, and the connecting/no-roots states use a consistent empty-state layout.
