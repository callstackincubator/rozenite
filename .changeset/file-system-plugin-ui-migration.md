---
'@rozenite/file-system-plugin': minor
---

Rebuild the File System DevTools panel on `@rozenite/ui`: a sidebar shows a persistent, lazily-loaded directory tree per root, and the content pane lists the selected directory's entries in a sortable table with a per-row export action, above a toolbar carrying the current path with copy-to-clipboard alongside reload and import. Selecting a file opens a detail pane with a sticky path bar (copy, export, and close), a collapsible metadata card, and the image/text preview in one scroll region; the pane stays hidden until something is selected. Importing a file now confirms overwrites with a themed dialog instead of a native browser prompt, and the connecting/no-roots states use a consistent empty-state layout.
