---
'@rozenite/agent-shared': minor
---

The output shaping helpers understand the list metadata from ADR 0004:

- `shapeToolResult` takes an options argument: `itemsKey` reads rows from a
  key other than `items`, `meta` limits the printed metadata to the declared
  keys (`[]` prints none; leaving it out prints every key, as before),
  `elideNullColumns` drops a column that is null on every row, and
  `paged: false` shapes an unpaged list that declares `rows`.
- `shapePaginatedRows` takes the same `elideNullColumns` option, plus
  `rowsKey` for the key rows are printed under while they stay expanded.
- `parseFields` accepts `all` to select every declared field.

Calls without the new arguments behave exactly as before.
