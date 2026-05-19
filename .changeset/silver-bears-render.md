---
'@rozenite/network-activity-plugin': minor
---

Render XML responses in the Network Activity panel and add a Raw view to JSON responses.

XML responses (`application/xml`, `text/xml`, and RFC 7303 composite types like `application/atom+xml`, `application/rss+xml`, `application/soap+xml`, `application/xhtml+xml`, ...) now render as a collapsible tree with copy affordances on elements, text, and CDATA values in the Preview tab; the Raw tab shows the XML source verbatim. Malformed XML falls back to source with a warning. The capture path was also extended so `application/xml` and `+xml` composite bodies actually reach the panel — previously they were dropped on the wire.

JSON responses gain a Preview/Raw toggle: Preview keeps the existing tree, Raw shows the body pretty-printed with 2-space indent regardless of how the wire response was formatted, so minified JSON is readable without leaving the panel.