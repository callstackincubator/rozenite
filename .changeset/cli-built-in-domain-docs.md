---
'rozenite': patch
---

The bundled `console`, `network`, `react`, `memory`, `performance` and `lynx`
agent docs now use the `rozenite agent <domain> <tool> --<arg>` grammar,
describe the new default columns, bounded body reads and request-detail
`include` sections, and correct earlier mistakes (`fields` is a CLI flag, not
a tool argument; the React host filter is `noHost`).
