---
'@rozenite/network-activity-plugin': minor
---

Render HTML responses in the Network Activity panel via a sandboxed iframe. The Preview tab shows the page with `sandbox=""` (scripts blocked) and a Content-Security-Policy that disallows external subresources (no outbound requests to images, stylesheets, or fonts referenced by the captured HTML). The Raw tab shows the HTML source. For 4xx/5xx responses a status banner appears above the preview so a styled error page can't visually misdirect.