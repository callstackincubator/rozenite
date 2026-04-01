# Performance Domain

Start a performance trace on the session target, reproduce the issue while recording, then stop and export the trace to a Metro-managed artifact under `.rozenite/agent/sessions/<deviceId>/traces`. Calls return artifact metadata only.

## Tools
- `startTrace` -> `{}` | `{"categories":["<category>",...]}` | `{"options":"<string>"}`
- `stopTrace` -> `{}` | `{"nameHint":"startup-regression"}`

## Minimal Flow
`startTrace` -> reproduce issue while recording -> `stopTrace`. Trace is written by Metro; call returns artifact metadata only.
