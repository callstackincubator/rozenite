---
name: memory
description: Capture heap snapshots or run allocation sampling over a reproduction, with artifacts written by Metro for offline analysis.
domain: memory
integrations: react-native, lynx
---

Capture one-off heap snapshots or run allocation sampling over a reproduction. Metro writes artifacts under `.rozenite/agent/sessions/<deviceId>/memory` and `.rozenite/agent/sessions/<deviceId>/profiles` for offline analysis.

## Tools

```sh
npx rozenite agent memory takeHeapSnapshot
npx rozenite agent memory takeHeapSnapshot --nameHint before-login
npx rozenite agent memory startSampling
npx rozenite agent memory startSampling --samplingInterval 16384
npx rozenite agent memory stopSampling --nameHint home-screen
```

## Flow

`takeHeapSnapshot` for one-shot heap capture.

Sampling:
`startSampling` -> reproduce issue -> `stopSampling`.

Calls return only artifact metadata, including the Metro-managed absolute and
relative paths; the snapshot or profile itself stays on disk.

## Platform availability

`takeHeapSnapshot` works on both React Native and Lynx. Allocation
sampling (`startSampling`, `stopSampling`) is React Native only — Lynx's
JS engine implements heap snapshots but not sampling — so on a Lynx
session this domain is reported `degraded` and the two sampling tools are
absent from its tool listing (`npx rozenite agent memory`).
