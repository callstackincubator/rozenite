# Performance Domain

Start a performance trace on the session target, reproduce the issue while recording, then stop and export the trace to a file. Exports are file-backed and return metadata only.

## Tools
- `startTrace` -> `{}` | `{"categories":["<category>",...]}` | `{"options":"<string>"}`
- `stopTrace` -> `{"filePath":"<path>"}`

## Minimal Flow
`startTrace` -> reproduce issue while recording -> `stopTrace` with `filePath`. Trace is written to the given path; call returns metadata only.
