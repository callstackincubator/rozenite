# @rozenite/network-activity-plugin

## 1.13.0

### Patch Changes

- Updated dependencies [[`7b00844`](https://github.com/callstackincubator/rozenite/commit/7b00844e6439bb7447bc2b61519a6aa6fc1c270f)]:
  - @rozenite/agent-shared@1.13.0
  - @rozenite/agent-bridge@1.13.0
  - @rozenite/plugin-bridge@1.13.0

## 1.12.0

### Patch Changes

- [#298](https://github.com/callstackincubator/rozenite/pull/298) [`a39eabd`](https://github.com/callstackincubator/rozenite/commit/a39eabd827aec9d7249086f7b318f64230f556b2) Thanks [@V3RON](https://github.com/V3RON)! - Filter Hermes internal bytecode frames out of Network Activity initiator symbolication requests so Metro no longer tries to read pseudo-files like `address at InternalBytecode.js`.

- Updated dependencies []:
  - @rozenite/agent-bridge@1.12.0
  - @rozenite/agent-shared@1.12.0
  - @rozenite/plugin-bridge@1.12.0

## 1.11.0

### Minor Changes

- [#270](https://github.com/callstackincubator/rozenite/pull/270) [`5dea81e`](https://github.com/callstackincubator/rozenite/commit/5dea81e4139aae51ef01b4db0aacdc66c8fb039c) Thanks [@draggie](https://github.com/draggie)! - Add a timeline view to Network Activity that shows requests as a waterfall. Drag a range on the timeline to filter the request list.

- [#272](https://github.com/callstackincubator/rozenite/pull/272) [`32d4ea3`](https://github.com/callstackincubator/rozenite/commit/32d4ea34b12b2c1adcc7d24698086bd492825935) Thanks [@draggie](https://github.com/draggie)! - Add a toolbar export button that downloads the current network activity session as a JSON file.

  The export includes HTTP requests, WebSocket connections, SSE streams, and realtime messages captured during the session, along with a summary (entry counts by type) and metadata (`schemaVersion`, `exportedAt`).

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.11.0
  - @rozenite/agent-shared@1.11.0
  - @rozenite/plugin-bridge@1.11.0

## 1.10.0

### Minor Changes

- [#271](https://github.com/callstackincubator/rozenite/pull/271) [`3a77ccf`](https://github.com/callstackincubator/rozenite/commit/3a77ccfce710a45c674c7cd05ca9a7f6aa422f4f) Thanks [@burczu](https://github.com/burczu)! - Image responses now render inline in the Network Activity panel. PNG, JPEG, GIF, WebP, and SVG show up as previews under a new Preview/Raw sub-tab. The Raw tab shows Content-Type and decoded size; for SVG, the Raw tab shows the source XML. Image responses above an in-capture 5 MB cap show a "Response too large for preview" message instead of crossing the bridge.

  Adds a Preview/Raw axis that subsequent response-viewer improvements (rendered HTML, formatted XML, JSON Raw, ...) will extend. The toggle is adaptive — hidden for formats with only one meaningful view. The user's last toggle choice sticks across responses within a panel session.

  The `response-body` bridge event's wire shape is extended additively to a discriminated union (`string | { kind: 'binary'; base64 } | { kind: 'binary-too-large'; size } | null`). Existing consumers that only handle the string variant continue to work unchanged.

- [#266](https://github.com/callstackincubator/rozenite/pull/266) [`3adbe11`](https://github.com/callstackincubator/rozenite/commit/3adbe117d38b00455b864a60bdc86b3cd151cbab) Thanks [@draggie](https://github.com/draggie)! - Add advanced request filters to Network Activity.

- [#263](https://github.com/callstackincubator/rozenite/pull/263) [`340b779`](https://github.com/callstackincubator/rozenite/commit/340b779c43b43702959dd9a29ed77041b73b970c) Thanks [@draggie](https://github.com/draggie)! - Show source-mapped request initiator details in Network Activity.

- [#274](https://github.com/callstackincubator/rozenite/pull/274) [`032ff3e`](https://github.com/callstackincubator/rozenite/commit/032ff3eb9795c7cb0c747d52b73d341a2871185e) Thanks [@burczu](https://github.com/burczu)! - Non-image binary responses now render with a metadata card + virtualized hex viewer, replacing the "Binary content not shown" placeholder. PDFs, fonts, audio, video, archives, and `application/octet-stream` payloads show their bytes in the classic offset / hex / ASCII layout, with a Download button on the metadata card that saves the file using a sensibly-derived name (`Content-Disposition` filename → URL last segment → `response.<ext>` from a small content-type map).

  Image responses get the same upgrade in their Raw tab — was metadata-only, now metadata + hex view + Download.

  The `getResponseBody` capture widens to cover everything that isn't text: arraybuffer responses and non-text non-image blobs now arrive at the panel as base64-encoded binary via the existing wire union, with chunked encoding so large payloads don't blow up `String.fromCharCode`. The 5 MB cap continues to apply uniformly; oversized responses surface as "Response too large for preview" with the Download button disabled.

  Post-this-release invariant: `body === null` on the wire means only "the plugin could not read the body at all" — every other shape arrives as a typed variant of the discriminated union.

- [#279](https://github.com/callstackincubator/rozenite/pull/279) [`571d273`](https://github.com/callstackincubator/rozenite/commit/571d2730a570016c60b018f7523945aaee03e15a) Thanks [@burczu](https://github.com/burczu)! - Virtualize large code blocks in the Network Activity panel.

  Text response bodies above 50,000 characters now render inside a virtualized 500 px scrollable window instead of an unbounded `<pre>` element. Smaller bodies and tree views (JSON, XML) are unaffected. This keeps the panel snappy on multi-megabyte responses (pretty-printed JSON, minified bundles served as text, large logs) without truncating any content.

- [#275](https://github.com/callstackincubator/rozenite/pull/275) [`c18dc0f`](https://github.com/callstackincubator/rozenite/commit/c18dc0fb335f4fc472b8392f5e6af72e658edde6) Thanks [@burczu](https://github.com/burczu)! - Render HTML responses in the Network Activity panel via a sandboxed iframe. The Preview tab shows the page with `sandbox=""` (scripts blocked) and a Content-Security-Policy that disallows external subresources (no outbound requests to images, stylesheets, or fonts referenced by the captured HTML). The Raw tab shows the HTML source.

- [#277](https://github.com/callstackincubator/rozenite/pull/277) [`e82fa22`](https://github.com/callstackincubator/rozenite/commit/e82fa2201d6e68c0e300a08c2bc49b640aa6fd69) Thanks [@burczu](https://github.com/burczu)! - Render XML responses in the Network Activity panel and add a Raw view to JSON responses.

  XML responses (`application/xml`, `text/xml`, and RFC 7303 composite types like `application/atom+xml`, `application/rss+xml`, `application/soap+xml`, `application/xhtml+xml`, ...) now render as a collapsible tree with copy affordances on elements, text, and CDATA values in the Preview tab; the Raw tab shows the XML source verbatim. Malformed XML falls back to source with a warning. The capture path was also extended so `application/xml` and `+xml` composite bodies actually reach the panel — previously they were dropped on the wire.

  JSON responses gain a Preview/Raw toggle: Preview keeps the existing tree, Raw shows the body pretty-printed with 2-space indent regardless of how the wire response was formatted, so minified JSON is readable without leaving the panel.

### Patch Changes

- [#273](https://github.com/callstackincubator/rozenite/pull/273) [`60a157e`](https://github.com/callstackincubator/rozenite/commit/60a157e4eb3a2b894bafa50decc1e04eb8b19374) Thanks [@V3RON](https://github.com/V3RON)! - Resolve the optional `react-native-nitro-fetch` dependency before React Native finishes initializing so Metro 0.82 does not show an error overlay when the package is not installed.

- Updated dependencies []:
  - @rozenite/agent-bridge@1.10.0
  - @rozenite/agent-shared@1.10.0
  - @rozenite/plugin-bridge@1.10.0

## 1.9.0

### Patch Changes

- [#240](https://github.com/callstackincubator/rozenite/pull/240) [`0e2a4db`](https://github.com/callstackincubator/rozenite/commit/0e2a4db7943f004b7f52422fbe23b679829e5b57) Thanks [@V3RON](https://github.com/V3RON)! - Rozenite now treats `application/*+json` responses as JSON in Network Activity, so vendor-specific JSON payloads render correctly instead of falling back to plain text.

- [#260](https://github.com/callstackincubator/rozenite/pull/260) [`9cea370`](https://github.com/callstackincubator/rozenite/commit/9cea370c441595eba266f800901656370bb608f8) Thanks [@V3RON](https://github.com/V3RON)! - Fix `react-native-nitro-fetch` not being resolved correctly in Metro by isolating the optional dependency import into its own bundle chunk. This ensures the network inspector works reliably even when `react-native-nitro-fetch` is not installed.

- Updated dependencies []:
  - @rozenite/agent-bridge@1.9.0
  - @rozenite/agent-shared@1.9.0
  - @rozenite/plugin-bridge@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.8.1
  - @rozenite/agent-shared@1.8.1
  - @rozenite/plugin-bridge@1.8.1

## 1.8.0

### Minor Changes

- [#222](https://github.com/callstackincubator/rozenite/pull/222) [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a) Thanks [@manapard](https://github.com/manapard)! - Add typed `./sdk` entrypoints for the official agent-enabled plugins backed by
  the same shared tool contracts used at runtime.

  These plugins now publish typed descriptor groups for `session.tools.call(...)`
  workflows, including shared public input/result types, while keeping their
  existing tool names and runtime behavior unchanged. The official agent SDK docs
  and plugin authoring guidance now also document this SDK export pattern,
  including the `network-activity` fallback note for environments without the
  built-in `network` domain.

- [#233](https://github.com/callstackincubator/rozenite/pull/233) [`90e7fb6`](https://github.com/callstackincubator/rozenite/commit/90e7fb603496e3db2a8d6823c04e6686679619cb) Thanks [@V3RON](https://github.com/V3RON)! - Added support for Nitro fetch traffic in Network Activity.

### Patch Changes

- Updated dependencies [[`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a), [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a)]:
  - @rozenite/agent-bridge@1.8.0
  - @rozenite/agent-shared@1.8.0
  - @rozenite/plugin-bridge@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies [[`a826e35`](https://github.com/callstackincubator/rozenite/commit/a826e35ffadcf79b9d2f1bb033666d3b27d40752)]:
  - @rozenite/agent-bridge@1.7.0
  - @rozenite/plugin-bridge@1.7.0

## 1.6.0

### Minor Changes

- [#198](https://github.com/callstackincubator/rozenite/pull/198) [`cc97b14`](https://github.com/callstackincubator/rozenite/commit/cc97b1433b0f6a93864060d980e869e08d7242bd) Thanks [@V3RON](https://github.com/V3RON)! - Add agent tools for inspecting HTTP, WebSocket, and SSE activity in the Network Activity plugin.

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.6.0
  - @rozenite/plugin-bridge@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.5.1

## 1.5.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.5.0

## 1.4.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.4.0

## 1.3.0

### Patch Changes

- [#172](https://github.com/callstackincubator/rozenite/pull/172) Thanks [@crockalet](https://github.com/crockalet)! - Converted FormData entries iterator to an array before reduce to avoid 'reduce is not a function' and keep request body parsing stable.

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.3.0
