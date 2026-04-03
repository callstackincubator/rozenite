# File System Plugin Domain

A Rozenite plugin for browsing app files and previewing file contents in React Native DevTools. It provides read-only filesystem inspection through either Expo FileSystem or an RNFS-compatible provider. Use it to discover roots, inspect directories, and preview files without mutating app data.

## Domain

- Plugin ID: `@rozenite/file-system-plugin`
- Domain token: `at-rozenite__file-system-plugin`

## Tools

- `list-roots` -> `{}`
- `list-entries` -> `{"path":"<directoryPath>"}` | `{"path":"<directoryPath>","offset":0,"limit":100}`
- `read-entry` -> `{"path":"<fileOrDirectoryPath>"}`
- `read-text-file` -> `{"path":"<filePath>"}` | `{"path":"<filePath>","maxBytes":1000000}`
- `read-image-file` -> `{"path":"<imagePath>"}` | `{"path":"<imagePath>","maxBytes":1000000}`

## Minimal Flow

`list-roots` -> `list-entries` -> `read-entry` -> `read-text-file` / `read-image-file`.

Use `list-roots` first to learn which root directories are available on the connected device.
