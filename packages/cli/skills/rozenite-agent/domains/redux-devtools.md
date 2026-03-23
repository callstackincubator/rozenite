# Redux DevTools Plugin Domain

A Rozenite plugin for Redux state inspection and curated history control in React Native DevTools. It exposes store discovery, current state reads, action-history inspection, normal Redux action dispatch, and safe Redux DevTools history operations such as jump, toggle, reset, rollback, commit, sweep, pause, and lock.

## Domain
- Plugin ID: `@rozenite/redux-devtools-plugin`
- Domain token: discovered at runtime via `rozenite agent domains --session <sessionId>`

## Tools
- `list-stores` -> `{}`
- `get-store-state` -> `{}` | `{"instanceId":"<instanceId>"}`
- `list-actions` -> `{}` | `{"instanceId":"<instanceId>"}` | `{"instanceId":"<instanceId>","offset":0,"limit":50}`
- `get-action-details` -> `{"actionId":2}` | `{"instanceId":"<instanceId>","actionId":2}`
- `dispatch-action` -> `{"action":{"type":"counter/increment"}}` | `{"instanceId":"<instanceId>","action":{"type":"todos/add","payload":{"text":"Buy milk"}}}`
- `jump-to-action` -> `{"actionId":2}` | `{"instanceId":"<instanceId>","actionId":2}`
- `toggle-action` -> `{"actionId":2}` | `{"instanceId":"<instanceId>","actionId":2}`
- `reset-history` -> `{}` | `{"instanceId":"<instanceId>"}`
- `rollback-state` -> `{}` | `{"instanceId":"<instanceId>"}`
- `commit-current-state` -> `{}` | `{"instanceId":"<instanceId>"}`
- `sweep-skipped-actions` -> `{}` | `{"instanceId":"<instanceId>"}`
- `set-recording-paused` -> `{"paused":true}` | `{"instanceId":"<instanceId>","paused":false}`
- `set-locked` -> `{"locked":true}` | `{"instanceId":"<instanceId>","locked":false}`

## Minimal Flow
Read:
`list-stores` -> `get-store-state` or `list-actions` -> `get-action-details`.

Mutation:
`dispatch-action` for normal Redux updates.

History control:
`jump-to-action`, `toggle-action`, `reset-history`, `rollback-state`, `commit-current-state`, `sweep-skipped-actions`, `set-recording-paused`, `set-locked`.

If multiple stores exist, include `instanceId`.