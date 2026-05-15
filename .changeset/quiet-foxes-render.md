---
'@rozenite/network-activity-plugin': minor
---

Non-image binary responses now render with a metadata card + virtualized hex viewer, replacing the "Binary content not shown" placeholder. PDFs, fonts, audio, video, archives, and `application/octet-stream` payloads show their bytes in the classic offset / hex / ASCII layout, with a Download button on the metadata card that saves the file using a sensibly-derived name (`Content-Disposition` filename → URL last segment → `response.<ext>` from a small content-type map).

Image responses get the same upgrade in their Raw tab — was metadata-only, now metadata + hex view + Download.

The `getResponseBody` capture widens to cover everything that isn't text: arraybuffer responses and non-text non-image blobs now arrive at the panel as base64-encoded binary via the existing wire union, with chunked encoding so large payloads don't blow up `String.fromCharCode`. The 5 MB cap continues to apply uniformly; oversized responses surface as "Response too large for preview" with the Download button disabled.

Post-this-release invariant: `body === null` on the wire means only "the plugin could not read the body at all" — every other shape arrives as a typed variant of the discriminated union.