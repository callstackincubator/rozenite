---
name: file-system
description: Browse app files and preview file contents read-only via Expo FileSystem or an RNFS-compatible provider.
domain: file-system
---

# File System Plugin Domain

A Rozenite plugin for browsing app files and previewing file contents in React Native DevTools. It provides read-only filesystem inspection through either Expo FileSystem or an RNFS-compatible provider. Use it to discover roots, inspect directories, and preview files without mutating app data.

## Domain

- Plugin ID: `@rozenite/file-system-plugin`
- Domain token: `file-system`

## Tools

```
npx rozenite agent file-system list-roots
npx rozenite agent file-system list-entries --path <directoryPath>
npx rozenite agent file-system read-entry --path <fileOrDirectoryPath>
npx rozenite agent file-system read-text-file --path <filePath>
npx rozenite agent file-system read-text-file --path <filePath> --offset 16384 --maxBytes 65536
npx rozenite agent file-system read-image-file --path <imagePath>
npx rozenite agent file-system read-image-file --path <imagePath> --inline
```

When the app enables agent file transfer, `export-file --path <filePath>` and `import-file --directoryPath <dir> --fileName <name> --base64 <data>` are registered too.

- `list-entries` returns 20 entries per page (`--limit` up to 100), with the directory `path` and `total` alongside. Rows show `name`, `isDirectory` and `size`; `--fields all` adds `path`, `modifiedAtMs` and `mimeTypeHint`. When more entries exist the output ends with a `next` command; run it to continue. Paging resumes after the last entry returned, so files created or deleted while you page are not repeated or skipped. If that entry was deleted, the page comes back empty with `reset: true`: list again without `--cursor`.
- `read-text-file` returns the first 16 KB of the file by default, with `totalBytes` and `truncated`; when more remains, `nextOffset` is where the next slice starts. Read the rest with `--offset <nextOffset>`, and raise `--maxBytes` (up to 10000000) to take more at once. Files the provider cannot read as text come back as a hex preview.
- `read-image-file` returns metadata only: `path`, `mimeTypeHint` and `size`. `--inline` adds the image as a base64 `dataUri`, for images up to `--maxBytes` (default 262144).
- `export-file` returns a file's exact bytes as base64 and refuses files over `--maxBytes` (default 1048576).

## Minimal Flow

`list-roots` -> `list-entries` -> `read-entry` -> `read-text-file` / `read-image-file`.

Use `list-roots` first to learn which root directories are available on the connected device.
