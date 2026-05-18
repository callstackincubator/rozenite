---
'@rozenite/network-activity-plugin': minor
---

Virtualize large code blocks in the Network Activity panel.

Text response bodies above 50,000 characters now render inside a virtualized 500 px scrollable window instead of an unbounded `<pre>` element. Smaller bodies and tree views (JSON, XML) are unaffected. This keeps the panel snappy on multi-megabyte responses (pretty-printed JSON, minified bundles served as text, large logs) without truncating any content.
