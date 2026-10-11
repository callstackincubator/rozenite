---
name: redux-devtools
description: Inspect Redux stores and action history, dispatch actions, and control curated DevTools history operations.
domain: redux-devtools
---

# Redux DevTools Plugin Domain

A Rozenite plugin for Redux state inspection and curated history control in React Native DevTools. It exposes store discovery, current state reads, action-history inspection, normal Redux action dispatch, and safe Redux DevTools history operations such as jump, toggle, reset, rollback, commit, sweep, pause, and lock.

## Domain

- Plugin ID: `@rozenite/redux-devtools-plugin`
- Domain token: `redux-devtools`

## Tools

```
npx rozenite agent redux-devtools list-stores
npx rozenite agent redux-devtools get-store-state
npx rozenite agent redux-devtools get-store-state --path todos.items --maxDepth 6
npx rozenite agent redux-devtools list-actions
npx rozenite agent redux-devtools get-action-details --actionId 2
npx rozenite agent redux-devtools get-action-details --actionId 2 --include state
npx rozenite agent redux-devtools dispatch-action --action '{"type":"todos/add","payload":{"text":"Buy milk"}}'
npx rozenite agent redux-devtools jump-to-action --actionId 2
npx rozenite agent redux-devtools toggle-action --actionId 2
npx rozenite agent redux-devtools reset-history
npx rozenite agent redux-devtools rollback-state
npx rozenite agent redux-devtools commit-current-state
npx rozenite agent redux-devtools sweep-skipped-actions
npx rozenite agent redux-devtools set-recording-paused --paused true
npx rozenite agent redux-devtools set-locked --locked false
```

If more than one store is registered, add `--instanceId <instanceId>` from `list-stores` to every call.

## Action History

`list-actions` returns the newest 20 actions per page (`--limit` up to 100), with `total` alongside. Rows show `actionId`, `type`, `timestamp` and `isCurrent`; `--fields isSkipped,hasError,liftedType` or `--fields all` adds the rest. When more actions exist the output ends with a `next` command; run it to continue. Paging resumes after the last action returned, so actions dispatched while you page are not repeated and none is skipped. If that action left the history, the page comes back empty with `reset: true`: list again without `--cursor`.

## State and Action Details

`get-store-state` and `get-action-details` cut values to 4 levels of nesting and 512 characters per string. Deeper objects read `[object(N keys)]` or `[array(N)]`, cut strings end in `[+N chars]`, and `truncated: true` says something was cut. To read further:

- `--path` selects one sub-tree. For `get-store-state` it is a path into the state (`--path todos.items.0`). For `get-action-details` it starts with `liftedAction` or `state` (`--path liftedAction.action.payload`).
- `--maxDepth` and `--maxValueLength` raise the limits.

`get-action-details` returns the state computed after the action only with `--include state` (or a `--path` starting with `state`).

## Minimal Flow

Read:
`list-stores` -> `get-store-state` or `list-actions` -> `get-action-details`.

Mutation:
`dispatch-action` for normal Redux updates.

History control:
`jump-to-action`, `toggle-action`, `reset-history`, `rollback-state`, `commit-current-state`, `sweep-skipped-actions`, `set-recording-paused`, `set-locked`.
