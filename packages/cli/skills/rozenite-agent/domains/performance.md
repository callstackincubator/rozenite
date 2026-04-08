Start a performance trace on the session target, reproduce the issue while recording, then stop and export the trace to a Metro-managed artifact under `.rozenite/agent/sessions/<deviceId>/traces`. Calls return only artifact metadata.

## Tools

- `startTrace` -> `{}` | `{"categories":["<category>",...]}` | `{"options":"<string>"}`
- `stopTrace` -> `{}` | `{"nameHint":"startup-regression"}`

## Flow

`startTrace` -> reproduce issue while recording -> `stopTrace`. Metro writes the trace; the call returns only artifact metadata.
