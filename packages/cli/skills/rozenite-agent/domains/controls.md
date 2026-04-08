# Controls Plugin Domain

A Rozenite plugin for exposing app-defined controls in React Native DevTools. You get a custom control panel: read runtime values, flip toggles, switch options, submit text input, and trigger actions (e.g. reset, refetch) without building extra debug screens. Use this domain to list sections and items, read values, and mutate them via `set-value` or `press-button`.

## Domain

- Plugin ID: `@rozenite/controls-plugin`
- Domain token: `at-rozenite__controls-plugin`

## Tools

- `list-sections` -> `{}`
- `get-item` -> `{"sectionId":"<id>","itemId":"<id>"}`
- `set-value` -> `{"sectionId":"<id>","itemId":"<id>","value":true}` | `{"sectionId":"<id>","itemId":"<id>","value":"option-a"}`
- `press-button` -> `{"sectionId":"<id>","itemId":"<id>"}`

## Item Types

- `text` — read-only display value; `set-value` will throw
- `toggle` — boolean value; `set-value` requires `boolean`
- `select` — string value from a fixed `options` list; `set-value` validates against valid options
- `input` — free-form string value; `set-value` requires `string`
- `button` — no value; use `press-button` to trigger

## Minimal Flow

`list-sections` -> `get-item` (to read current value) -> `set-value` or `press-button`.

Mutation:
`set-value` / `press-button`.

Disabled items will throw on mutation attempts.
