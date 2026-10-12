# @rozenite/network-activity-plugin

## 2.5.0

### Minor Changes

- [#541](https://github.com/callstackincubator/rozenite/pull/541) [`56cdf09`](https://github.com/callstackincubator/rozenite/commit/56cdf098c5b3ba2bfc8c4461b1631030c9b40e7d) Thanks [@V3RON](https://github.com/V3RON)! - `listRequests` and `listRealtimeConnections` now page with the shared agent
  cursor, keyed by `requestId`: requests captured while an agent pages no
  longer shift the next page, and a cursor from an earlier recording, or one
  whose request was evicted, answers `reset: true` instead of an error. An
  invalid `limit` is now an error instead of quietly falling back to 20.

  Default changes, each reachable through an argument:

  - `getRequestBody` / `getResponseBody`: the whole body → at most 16384 bytes.
    `offset` and `maxBytes` read any range, and the result reports
    `totalBytes`, `truncated` and, when truncated, `nextOffset`, like the
    built-in `network` domain: both cut with the same `sliceUtf8` from
    `@rozenite/agent-shared`, so a range never runs past `maxBytes` and never
    ends inside a multi-byte character.
  - Pages printed by the CLI: the full `recording` block → nothing but the
    rows. The SDK result still carries it, and `getRecordingStatus` returns it.

- [#555](https://github.com/callstackincubator/rozenite/pull/555) [`6a46e9c`](https://github.com/callstackincubator/rozenite/commit/6a46e9c49ba37a6de4b527bb53a50cdb732bb167) Thanks [@V3RON](https://github.com/V3RON)! - The Network Activity panel is rebuilt on `@rozenite/ui`, so it follows the DevTools
  light and dark themes instead of always rendering dark. Every feature stays: the
  request list with filters, sorting and selection, the timeline, the side panel with
  headers, request and response bodies, cookies, initiator, timing and WebSocket and
  SSE messages, response overrides, and copying a request as cURL or `fetch`. The
  side panel and the columns of the request list are now resizable, the list shows an
  empty state, rows can be picked with the keyboard, and failed requests read as
  errors. The Timing tab now shows the request's real start and end times.

- [#512](https://github.com/callstackincubator/rozenite/pull/512) [`fd42c14`](https://github.com/callstackincubator/rozenite/commit/fd42c14fa4928f9e373e5ac3d35c93e02b234737) Thanks [@V3RON](https://github.com/V3RON)! - Rewrote HTTP capture around a single recorder: the `XMLHttpRequest` hook is
  now the primary capture path for the built-in stack (covering Axios,
  `react-native-sse` and React Native's own `fetch`), a generic fetch wrapper
  covers Expo's `expo/fetch` (and, only when it lazily resolves to that same
  implementation, the global `fetch`), and `react-native-nitro-fetch` HTTP
  traffic is translated into the same recorder in one shot instead of being
  diffed. RN's own `fetch` polyfill, an application wrapper around it, and
  nitro's `fetch` are never wrapped by the generic fetch path — the XHR hook
  and nitro's `NetworkInspector` already record that traffic, and either can
  send its request asynchronously, which would double-record it if wrapped.
  One module now owns request ids, timing, every emitted event and the
  response body registry, replacing three separate capture paths, their own
  emitters, and duplicate timing/body logic.

  Behavior changes, some of them to the wire format:

  - nitro response and request bodies, and nitro WebSocket messages, are now
    captured up to 1 MiB, up from a 4 KiB cap.
  - `expo/fetch` response bodies are captured up to 5 MiB; larger bodies are
    reported by size only. `text/event-stream` responses from `expo/fetch`
    are recorded without a body and are not read by the plugin at all.
  - Expo SDK 54–55 keep capturing `expo/fetch` response bodies the app itself
    reads via `text()`/`json()`/`arrayBuffer()`, as before; `blob()` and direct
    stream readers are not observed on those SDKs, and a body the app never
    reads is not captured. This path is covered by unit tests only, because the
    playground runs an Expo SDK whose `clone()` works. Expo SDK 56 and newer
    are unaffected.
  - Requests captured from `react-native-nitro-fetch` now get the same
    `req_<timestamp>_<random>` request id every other transport uses, instead
    of nitro's own entry id.
  - A fetch request's `AbortSignal` is no longer sent on `request-sent` (it
    serialized to an uninformative `{}` and was never part of the documented
    `Request` wire type).
  - Initiator stacks are parsed in the V8/Hermes `at fn (file:line:col)`
    format only; the JavaScriptCore `fn@file:line:col` format is no longer
    parsed, so apps running on JSC get no initiator location.
  - The initiator preview attached to a fetch-captured request now starts at
    the application's own calling frame, matching the XHR path, instead of at
    an internal async-transpilation helper frame.
  - A fetch call still in flight when `network-disable` arrives now completes
    and its events still reach a listener that stays subscribed (e.g. the
    agent tools' internal state), instead of being silently dropped.

  No change to the public `useNetworkActivityDevTools`/
  `withOnBootNetworkActivityRecording` API or the DevTools panel.

- [#551](https://github.com/callstackincubator/rozenite/pull/551) [`22f5e0a`](https://github.com/callstackincubator/rozenite/commit/22f5e0a5cd8a81af9ddd273066aaff230cd17c7e) Thanks [@V3RON](https://github.com/V3RON)! - The Rozenite shell, the standalone app and its window, the Vite dev host and
  the official plugin panels now share the rozenite.dev look: the crimson
  stepped mark, the near-black theme with the crimson-rose accent, square
  corners and no shadows. Network Activity and SQLite drop their own palettes
  for the shared one, the Overlay plugin's on-device slider uses the new accent,
  and plugins generated with `rozenite generate` start from the new colours.

### Patch Changes

- [#534](https://github.com/callstackincubator/rozenite/pull/534) [`201e340`](https://github.com/callstackincubator/rozenite/commit/201e340411c50d3ecf04f477197c325988d955a8) Thanks [@theluckystrike](https://github.com/theluckystrike)! - Show the request body in Network Activity when `fetch` is called with a
  `Request` instance. `ky` v2 does this for every request, so its POST and PUT
  bodies sent through `expo/fetch` were missing from the panel.

- [#560](https://github.com/callstackincubator/rozenite/pull/560) [`a7985fa`](https://github.com/callstackincubator/rozenite/commit/a7985fa7876500ed5dd47bb3e61a97c75e0cfb58) Thanks [@V3RON](https://github.com/V3RON)! - The published packages no longer include development fixtures, tests and build
  configuration (such as `rozenite.config.ts`, `__tests__` and `tsconfig.json`),
  which makes installs smaller: `@rozenite/expo-atlas-plugin` alone drops from
  about 6 MB to 90 KB. Every package now lists its `CHANGELOG.md`, so changelogs
  ship. Plugins generated by `rozenite generate` get the same treatment: they
  publish only their built output, without `rozenite.config.ts`, sources, tests
  or build configuration.

- [#560](https://github.com/callstackincubator/rozenite/pull/560) [`a7985fa`](https://github.com/callstackincubator/rozenite/commit/a7985fa7876500ed5dd47bb3e61a97c75e0cfb58) Thanks [@V3RON](https://github.com/V3RON)! - Fix dev-mode bundles (Re.Pack, webpack, Rspack and Vite) failing to resolve
  `@rozenite/agent-bridge`, `@rozenite/agent-shared` and the other packages
  that publish an `exports` map: it carried a `development` condition pointing at
  TypeScript source that was not in the package. The published packages no
  longer have that condition, so these tools pick the built output in every mode.

  `rozenite build` also stops adding a `development` condition to a plugin's
  `./sdk` export and removes the `./sdk.ts` one that earlier versions wrote; a
  `development` condition you wrote yourself (any other value) is kept. If your
  `package.json` has a `publishConfig.exports`, `rozenite build` now keeps its
  managed entries (`.`, `./sdk`, `./metro`) in step with `exports`.

- Updated dependencies [[`2a72f21`](https://github.com/callstackincubator/rozenite/commit/2a72f2115eb6eda0b806fa4fcdaf5427f8b2d2c9), [`fb29800`](https://github.com/callstackincubator/rozenite/commit/fb298007eea021f23863b1b6a9534cb62d5260bf), [`f59e90b`](https://github.com/callstackincubator/rozenite/commit/f59e90b8cb63cfbe045c1768bb482424a8650cb5), [`a7985fa`](https://github.com/callstackincubator/rozenite/commit/a7985fa7876500ed5dd47bb3e61a97c75e0cfb58), [`a7985fa`](https://github.com/callstackincubator/rozenite/commit/a7985fa7876500ed5dd47bb3e61a97c75e0cfb58), [`fd4512e`](https://github.com/callstackincubator/rozenite/commit/fd4512e522f9af4ed49a800d4b4a066c9994dc35), [`22f5e0a`](https://github.com/callstackincubator/rozenite/commit/22f5e0a5cd8a81af9ddd273066aaff230cd17c7e), [`212e6fe`](https://github.com/callstackincubator/rozenite/commit/212e6fe0fa7b3f6cfa7feeabee513de88fea4c47)]:
  - @rozenite/agent-shared@2.5.0
  - @rozenite/agent-bridge@2.5.0
  - @rozenite/plugin-bridge@2.5.0
  - @rozenite/ui@2.5.0

## 2.4.0

### Patch Changes

- Updated dependencies [[`3c4905f`](https://github.com/callstackincubator/rozenite/commit/3c4905f9e6a46f456b8ddd1dee209353b9e96c34)]:
  - @rozenite/agent-shared@2.4.0
  - @rozenite/agent-bridge@2.4.0
  - @rozenite/plugin-bridge@2.4.0

## 2.3.0

### Minor Changes

- [#457](https://github.com/callstackincubator/rozenite/pull/457) [`3a29044`](https://github.com/callstackincubator/rozenite/commit/3a29044d0b72354ff80cb2e044afe7d51b800348) Thanks [@V3RON](https://github.com/V3RON)! - Every official plugin now declares the integrations it supports, so a plugin that cannot work in the environment you are debugging can say so instead of loading and failing.

  Controls, Feature Flags, React Hook Form and TanStack Query import nothing from `react-native` on the device and declare every integration, Lynx included. Plugins built on native modules — SQLite, Storage, File System and Performance Monitor — declare React Native only, and so do Network Activity and Require Profiler: `react-native-web` provides no `TurboModuleRegistry` or `DevSettings`, which their device code calls. The rest use React Native APIs that do have web equivalents, and also declare Rozenite for Web.

### Patch Changes

- Updated dependencies [[`a1f5280`](https://github.com/callstackincubator/rozenite/commit/a1f5280e785e3db34b23b0877d52ad19c831dc88), [`c5a3cfc`](https://github.com/callstackincubator/rozenite/commit/c5a3cfc90abd6347ab0321590f7ca262896a1465), [`158f4e5`](https://github.com/callstackincubator/rozenite/commit/158f4e5406d6428e24164bdde82d459030fa7309)]:
  - @rozenite/agent-shared@2.3.0
  - @rozenite/plugin-bridge@2.3.0
  - @rozenite/agent-bridge@2.3.0

## 2.2.0

### Patch Changes

- Updated dependencies [[`dffeda5`](https://github.com/callstackincubator/rozenite/commit/dffeda53c57f491a303108937d4b4ce68054226f), [`4f5fe74`](https://github.com/callstackincubator/rozenite/commit/4f5fe747ca0c6e93d0bf05076c7e2e2ad25fd744)]:
  - @rozenite/agent-bridge@2.2.0
  - @rozenite/plugin-bridge@2.2.0
  - @rozenite/agent-shared@2.2.0

## 2.1.0

### Patch Changes

- [#398](https://github.com/callstackincubator/rozenite/pull/398) [`bb45bb6`](https://github.com/callstackincubator/rozenite/commit/bb45bb6bbba2c896f2856ded3a8501c2ee527bf8) Thanks [@V3RON](https://github.com/V3RON)! - Replace the private `react-native/Libraries/WebSocket/WebSocketInterceptor` import with a self-contained implementation built on the public `TurboModuleRegistry` and `NativeEventEmitter` APIs, so the plugin no longer depends on React Native's internal module paths (compatible with [Strict TypeScript API](https://reactnative.dev/docs/strict-typescript-api)).

- Updated dependencies []:
  - @rozenite/agent-bridge@2.1.0
  - @rozenite/agent-shared@2.1.0
  - @rozenite/plugin-bridge@2.1.0

## 2.0.0

### Minor Changes

- [#308](https://github.com/callstackincubator/rozenite/pull/308) [`5e5d4ca`](https://github.com/callstackincubator/rozenite/commit/5e5d4ca7ad25263ca040455141b0c8654acbb08e) Thanks [@V3RON](https://github.com/V3RON)! - Show Expo SDK 54+ `expo/fetch` activity in Network Activity, including Expo's
  SDK 56+ default global fetch alias.

### Patch Changes

- Updated dependencies [[`a57b914`](https://github.com/callstackincubator/rozenite/commit/a57b91448e6cc9b88bd987bf462f07deef6b0d55), [`fa96bb8`](https://github.com/callstackincubator/rozenite/commit/fa96bb84d53d264b1f30aa7034ec678711a2c6b1), [`476a27f`](https://github.com/callstackincubator/rozenite/commit/476a27f5532f4e35ad66feb5c9481b9396592d14)]:
  - @rozenite/agent-bridge@2.0.0
  - @rozenite/agent-shared@2.0.0
  - @rozenite/plugin-bridge@2.0.0

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
