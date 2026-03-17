# React Navigation Plugin Domain

A Rozenite plugin for React Navigation debugging and inspection in React Native DevTools. It provides real-time navigation state monitoring, action timeline inspection, and deep-link testing (React Navigation v7). Use this domain to read focused route and root state, navigate by route name, go back, open deep links, or dispatch low-level actions when needed.

## Domain
- Plugin ID: `@rozenite/react-navigation-plugin`
- Domain token: discovered at runtime via `rozenite agent domains --session <sessionId>`

## Tools
- `get-root-state` -> `{}`
- `get-focused-route` -> `{}`
- `list-actions` -> `{}` | `{"offset":0,"limit":100}`
- `navigate` -> `{"name":"<routeName>"}` | `{"name":"<routeName>","params":{"id":1}}`
- `go-back` -> `{}` | `{"count":2}`
- `open-link` -> `{"href":"myapp://route"}`
- `dispatch-action` -> `{"action":{"type":"NAVIGATE","payload":{"name":"Home"}}}`
- `reset-root` -> `{"state":{...}}`

## Minimal Flow
`get-focused-route` or `get-root-state` -> optional `list-actions` -> `navigate` / `go-back`.

Fallback:
`dispatch-action` or `reset-root` only when high-level navigation calls are not enough.
