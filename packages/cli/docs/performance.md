---
name: performance
description: Start and stop a performance trace on the session target, exporting a Metro-managed trace artifact for offline analysis.
domain: performance
integrations: react-native
---

Start a performance trace on the session target, reproduce the issue while recording, then stop and export the trace to a Metro-managed artifact under `.rozenite/agent/sessions/<deviceId>/traces`. Calls return only artifact metadata.

## Tools

```sh
npx rozenite agent performance startTrace
npx rozenite agent performance startTrace --categories <category>,<category>
npx rozenite agent performance startTrace --options <string>
npx rozenite agent performance stopTrace --nameHint startup-regression
```

## Flow

`startTrace` -> reproduce issue while recording -> `stopTrace`. Metro writes the trace; the call returns only artifact metadata.

## Platform availability

React Native only. Lynx's `Tracing` domain is Perfetto-based rather than
Chrome-based — same name, different protocol — so this domain is reported
`unsupported` on a Lynx session rather than silently producing an empty
trace artifact. Capture Lynx traces through Lynx DevTool instead.
