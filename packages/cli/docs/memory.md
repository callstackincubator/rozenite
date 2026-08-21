---
name: memory
description: Capture heap snapshots or run allocation sampling over a reproduction, with artifacts written by Metro for offline analysis.
domain: memory
platforms: react-native, lynx
---

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

## Platform availability

`takeHeapSnapshot` works on both React Native and Lynx. Allocation
sampling (`startSampling`, `stopSampling`) is React Native only — Lynx's
JS engine implements heap snapshots but not sampling — so on a Lynx
session this domain is reported `degraded` and the two sampling tools are
absent from `list-tools`.
