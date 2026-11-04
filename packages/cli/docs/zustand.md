---
name: zustand
description: Inspect Zustand stores and their transition history, call store actions, set values, time travel and pause recording.
domain: zustand
---

# Zustand Plugin Domain

A Rozenite plugin for Zustand state inspection in React Native DevTools. It exposes every store wrapped in `rozenite()`: current state, the recorded transitions with their action names, arguments and patches, action calls, value edits, time travel and recording pause. The app must call `useZustandAgentTools()`.

## Domain

- Plugin ID: `@rozenite/zustand-plugin`
- Domain token: `zustand`

## Tools

```
npx rozenite agent zustand list-stores
npx rozenite agent zustand get-state
npx rozenite agent zustand get-state --path cart.items.0 --maxDepth 6
npx rozenite agent zustand list-transitions
npx rozenite agent zustand get-transition --seq 12
npx rozenite agent zustand invoke-action --action addItem --args '["sku-1","Milk"]'
npx rozenite agent zustand set-value --path settings.theme --value '"dark"'
npx rozenite agent zustand jump-to-transition --seq 12
npx rozenite agent zustand set-recording --value false
```

If more than one store is registered, add `--storeId <storeId>` from `list-stores` to every call.

## Values and Paths

State is returned as tagged JSON: values JSON cannot hold are objects with a `$t` key, such as `{"$t":"fn"}` for an action, `{"$t":"date","v":"…"}`, and `map`, `set` or `class` with their contents under `v`. `get-state` cuts values to 4 levels of nesting, 512 characters per string and 100 items per array or object, and says `truncated: true` when it did; `--path`, `--maxDepth`, `--maxValueLength` and `--maxItems` read further.

Paths are dot-separated and follow the state: array and Set items by index, and a Map entry as `<index>.1` for its value (`<index>.0` for its key). Paths never include the `v` segment that `get-state` shows inside a tagged Map, Set or class instance. `changedPaths` from `list-transitions` use the same form, so they can be passed to `get-state` and `set-value`. `set-value` requires every segment but the last to exist. A whole Map entry (`<index>`) is set as a `[key, value]` pair; anything else there is an error, not a silent no-op.

## History

`list-transitions` returns the newest 20 transitions per page (`--limit` up to 100): `seq`, the action name, how it was attributed (`source`) and the changed paths. The device keeps the last `maxAge` transitions of each store (50 by default). `get-transition` adds the action arguments and the exact patches, cut to the same bounds as `get-state`.

## Minimal Flow

Read:
`list-stores` -> `get-state` or `list-transitions` -> `get-transition`.

Mutation:
`invoke-action` with an action path from `list-stores`, or `set-value` for a direct edit.

History control:
`jump-to-transition` restores the device's own copy of the state after a transition (or the state before the oldest one held); store actions are kept, and `persist()` writes the restored state to storage. The jump is not itself a transition. `set-recording` pauses history.
