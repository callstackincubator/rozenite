# Memory Domain

Capture one-off heap snapshots or run allocation sampling over a reproduction. Artifacts are written by Metro under `.rozenite/agent/sessions/<deviceId>/memory` and `.rozenite/agent/sessions/<deviceId>/profiles` for offline analysis.

## Tools
- `takeHeapSnapshot` -> `{}` | `{"nameHint":"before-login"}`
- `startSampling` -> `{}`
- `stopSampling` -> `{}` | `{"nameHint":"home-screen"}`

## Minimal Flow
`takeHeapSnapshot` for one-shot heap capture.

Sampling:
`startSampling` -> reproduce issue -> `stopSampling`.

The returned artifact metadata includes the Metro-managed absolute path and relative path.
