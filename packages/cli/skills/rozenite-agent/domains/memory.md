Capture one-off heap snapshots or run allocation sampling over a reproduction. Metro writes artifacts under `.rozenite/agent/sessions/<deviceId>/memory` and `.rozenite/agent/sessions/<deviceId>/profiles` for offline analysis.

## Tools

- `takeHeapSnapshot` -> `{}` | `{"nameHint":"before-login"}`
- `startSampling` -> `{}`
- `stopSampling` -> `{}` | `{"nameHint":"home-screen"}`

## Flow

`takeHeapSnapshot` for one-shot heap capture.

Sampling:
`startSampling` -> reproduce issue -> `stopSampling`.

Returned artifact metadata includes the Metro-managed absolute and relative paths.
