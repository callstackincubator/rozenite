# Memory Domain

Capture one-off heap snapshots or run allocation sampling over a reproduction. Exports are file-backed (e.g. `.heapsnapshot`, `.heapprofile`) for offline analysis.

## Tools
- `takeHeapSnapshot` -> `{"filePath":"<path>.heapsnapshot"}`
- `startSampling` -> `{}`
- `stopSampling` -> `{"filePath":"<path>.heapprofile"}`

## Minimal Flow
`takeHeapSnapshot` for one-shot heap capture.

Sampling:
`startSampling` -> reproduce issue -> `stopSampling`.
