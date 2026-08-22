---
'@rozenite/ui': minor
---

Add three primitives for building log and stream panels.

`ToggleGroup` is a segmented control for filters where more than one option
can be active at once — log levels, tags, sources. It reads as a sibling of
`Tabs`, and supports single or multiple selection, icon-only items, and the
three control sizes.

`VirtualizedList` is the non-tabular counterpart to `VirtualizedDataTable`,
for large streams of freely-composed rows that vary in height. Rows need no
measurement or fixed height, and `followOutput` pins the view to the newest
row while entries stream in, releasing as soon as the reader scrolls away —
the affordance a live log tail needs.

`QueryField` is a query input that highlights the parts of a query as the
reader types. It understands a small filter grammar out of the box —
`level>=warn tag:auth -"retry"` — and re-reads the text on every keystroke,
so the colors follow an edit of any length and an unterminated quote shows
as a typo before the query is run. A panel that owns a different query
language passes its own token ranges instead and `QueryField` paints those,
so any syntax can be brought to it. The exported `tokenizeQuery` is the
built-in grammar on its own, for callers that want to reuse it.
