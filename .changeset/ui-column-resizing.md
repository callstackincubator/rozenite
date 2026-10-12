---
'@rozenite/ui': minor
---

`DataTable` and `VirtualizedDataTable` gain opt-in column resizing through a `columnResizing`
prop. Pass `true`, or `{ defaultSize, minSize, maxSize }` to tune it and
`{ sizing, onSizingChange }` to control and persist the widths (pass both, a `sizing` without
`onSizingChange` cannot resize). Each resizable header gets a focusable drag handle on its right
edge that works with mouse, touch and the arrow keys, and resets on double-click; a column opts
out with `enableResizing: false`. Tables that don't opt in are unchanged.

`VirtualizedDataTable` also no longer renders its empty state as a bare `<tr>` inside `<table>`,
which logged a React DOM-nesting error on every empty table, and a key press on a button or
field inside an actionable row no longer activates the row.
