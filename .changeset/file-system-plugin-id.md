---
'@rozenite/file-system-plugin': patch
---

Fix the File System panel showing no roots and no files. The plugin's message channel used `file-system` as its `pluginId`, while every other plugin uses its package name — the id the DevTools runtime derives panels from. Once `@rozenite/shell` started routing `pluginId` messages to only that plugin's panels, every `fs:*` reply from the device was addressed to a plugin id no mounted panel claimed and was dropped, so the panel sat on "No file system roots" forever. The channel now uses `@rozenite/file-system-plugin`, matching the package name and the plugin's agent tools.

Also stop re-announcing `fs:ready` on every render of the host component. The `useFileSystemDevTools` subscription effect depended on the whole `options` object, which is a new value each render for the usual inline-literal call site; each teardown/re-announce made the panel wipe its roots and entries and refetch them.
