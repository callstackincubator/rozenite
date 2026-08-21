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
reader types. It owns no grammar and no operator vocabulary: the caller
tokenizes its own query language and hands over ranges, and `QueryField`
paints them, so a panel can bring any query syntax. Malformed fragments can
be marked so a typo is visible before the query is run.
