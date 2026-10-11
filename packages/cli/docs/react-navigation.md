---
name: react-navigation
description: Inspect React Navigation state, action history, and dispatch navigation actions or deep links via the React Navigation plugin.
domain: react-navigation
---

# React Navigation Plugin Domain

A Rozenite plugin for React Navigation debugging and inspection in React Native DevTools. It provides real-time navigation state monitoring, action timeline inspection, and deep-link testing (React Navigation v7). Use this domain to read focused route and root state, navigate by route name, go back, open deep links, or dispatch low-level actions when needed.

## Domain

- Plugin ID: `@rozenite/react-navigation-plugin`
- Domain token: `react-navigation`

## Tools

```
npx rozenite agent react-navigation get-root-state
npx rozenite agent react-navigation get-focused-route
npx rozenite agent react-navigation list-actions
npx rozenite agent react-navigation get-action-details --id 12
npx rozenite agent react-navigation navigate --name Profile
npx rozenite agent react-navigation navigate --name Profile --params '{"id":1}'
npx rozenite agent react-navigation go-back
npx rozenite agent react-navigation go-back --count 2
npx rozenite agent react-navigation open-link --href myapp://route
npx rozenite agent react-navigation dispatch-action --action '{"type":"NAVIGATE","payload":{"name":"Home"}}'
npx rozenite agent react-navigation reset-root --state '{...}'
```

## Action History

`list-actions` returns the newest 20 recorded actions per page (`--limit` up to 100), with `total` alongside. Rows show `id`, `timestamp`, `type` and `routeName`, the route the action targeted (from the action payload, else the route focused after it). When more actions exist the output ends with a `next` command; run it to continue. Paging resumes after the last action returned; if that action left the history, the page comes back empty with `reset: true`: list again without `--cursor`.

The navigation state after each action and the stack that dispatched it are large, so rows leave them out. Read them for one action with `get-action-details --id <id>`, or for a whole page with `list-actions --include state,origin`.

## Minimal Flow

`get-focused-route` or `get-root-state` -> optional `list-actions` -> `get-action-details` -> `navigate` / `go-back`.

Fallback:
`dispatch-action` or `reset-root` only when high-level navigation calls are not enough.
