# rozenite

## 2.4.0

### Minor Changes

- [#490](https://github.com/callstackincubator/rozenite/pull/490) [`3c4905f`](https://github.com/callstackincubator/rozenite/commit/3c4905f9e6a46f456b8ddd1dee209353b9e96c34) Thanks [@V3RON](https://github.com/V3RON)! - Targets returned by `rozenite open` and the agent's targets endpoint now
  report which integration (React Native or Lynx) serves them, and target
  discovery goes through one Rozenite endpoint on both integrations.

  `MetroTarget.pageId` is now the page's id within its own device (the
  `page` query parameter of `webSocketDebuggerUrl`) instead of the globally
  unique `<deviceId>-<pageId>` composite, so reconnecting after a disconnect
  correctly lands back on the page that was being debugged.

  `rozenite agent targets` now includes each target's `integration` in its
  output.

  The Lynx dev server no longer drops and re-registers every connected Lynx
  client on each of its periodic device-discovery sweeps, which showed up in
  Rozenite as a reconnect every fifteen seconds.

### Patch Changes

- Updated dependencies [[`3c4905f`](https://github.com/callstackincubator/rozenite/commit/3c4905f9e6a46f456b8ddd1dee209353b9e96c34)]:
  - @rozenite/agent-shared@2.4.0
  - @rozenite/agent-sdk@2.4.0
  - @rozenite/tools@2.4.0

## 2.3.0

### Minor Changes

- [#449](https://github.com/callstackincubator/rozenite/pull/449) [`1bbf5d2`](https://github.com/callstackincubator/rozenite/commit/1bbf5d28527639bd4ec5cb0971ac547aa601f0c2) Thanks [@V3RON](https://github.com/V3RON)! - Name the framework being debugged in the UI, now that a Rozenite window can be showing React Native, Lynx or a web app. The standalone app names it in its status footer next to the connection status, and in its own window title ("Lynx · Pixel 8 - Rozenite") — in a browser tab and in the Electron shell alike, so several open Rozenite windows are tellable apart at a glance. React Native DevTools keeps the title it sets itself; Rozenite does not touch it. Each target reports its own framework over the metadata event React Native already sends during the handshake: `@rozenite/lynx-dev` now answers `ReactNativeApplication.enable` with the `metadataUpdated` event a device implementing that domain would send, naming Lynx in `integrationName` while `platform` keeps meaning the device OS.

- [#456](https://github.com/callstackincubator/rozenite/pull/456) [`4afc448`](https://github.com/callstackincubator/rozenite/commit/4afc448f9e7dae4736155f173b7d726e31458d08) Thanks [@V3RON](https://github.com/V3RON)! - Lay the groundwork for refusing a plugin on an integration it doesn't support, instead of loading it and breaking. Plugins can now declare which environments they work in — `react-native`, `react-native-web`, `lynx`, or `lynx-web` — via `integrations` in `rozenite.config.ts`; omitting it defaults to `['react-native']`, and the resolved list is always reported in the plugin manifest. Nothing enforces compatibility yet — that's a follow-up.

  Resolving which integration a connected target actually is takes two halves. The dev server supplies the host it serves (`react-native` or `lynx`), which follows from the installed integration and so cannot be wrong. The other half — whether the target is a browser — is answered by the device itself: both DevTools hosts evaluate a small self-contained expression in the connected runtime during bootstrap, and `resolveIntegration` combines the two. Asking the device is what makes the answer immediate and certain; the alternative was reading React Native's `ReactNativeApplication.metadataUpdated`, an event Rozenite neither emits nor can order, so a host that asked early would report a browser target as native with no way to tell that answer from a real one. A probe that fails leaves the target unknown rather than guessing.

  `@rozenite/middleware`'s `platform` config option, unreleased until now, is renamed to `integration` to avoid colliding with the device-OS meaning `platform` carries everywhere else in the system.

- [#448](https://github.com/callstackincubator/rozenite/pull/448) [`a1f5280`](https://github.com/callstackincubator/rozenite/commit/a1f5280e785e3db34b23b0877d52ad19c831dc88) Thanks [@V3RON](https://github.com/V3RON)! - Teach Rozenite for Agents which built-in domains the connected target can
  actually back, so a Lynx session no longer looks like a React Native one.

  The five built-in domains were designed against React Native's CDP surface, and
  Lynx exposes a different one: it registers no `Network` domain at all, has no
  React DevTools backend, and implements a Perfetto-based `Tracing` domain that
  shares Chrome's method names but not its protocol. Until now every session
  advertised all five regardless, so an agent on a Lynx target could only find out
  by calling — and two of the three ways that fails are silent. `network` errored
  with a raw protocol code, `react` returned nothing, `performance` finalised a
  trace artifact containing zero events, and heap sampling appeared to start and
  collected nothing.

  Each session now resolves a capability profile from the integration its dev
  server hosts.
  Unsupported tools are never registered, so `list-tools` is honest; unavailable
  domains stay visible in `rozenite agent domains` with an `availability` column, a
  reason, and — for `network` — the `@rozenite/network-activity-plugin` domain to
  use instead. Calling an unsupported tool fails during resolution with that same
  explanation rather than a protocol error, so the agent gets a next step instead
  of a dead end. On Lynx that means `console`, plugin domains, app tools and
  `memory.takeHeapSnapshot` are reported supported, `memory` is degraded, and
  `network`, `react` and `performance` are unavailable with reasons.

  Three fixes to the CDP command channel apply to every integration, not just
  Lynx. A
  device error now names the method it refused instead of arriving as a stringified
  error object; waits on a device event are bounded, so a capture whose completion
  event never arrives fails with a diagnosis instead of hanging forever; and
  `stopTrace` refuses to hand back a trace artifact containing no events rather
  than reporting a successful capture of nothing.

  Both new fields on the session tools response are optional, so a CLI and a Metro
  on different versions keep working together — an older server simply reports no
  capability data and every domain is treated as supported, exactly as before.

- [#484](https://github.com/callstackincubator/rozenite/pull/484) [`c4a8909`](https://github.com/callstackincubator/rozenite/commit/c4a8909de7cf7339e4a66c68f58f9ecbe16561d7) Thanks [@V3RON](https://github.com/V3RON)! - `rozenite open` now finds Lynx devices too. Without `--port`, it queries the
  default port of every supported integration — Metro's `8081` and the Lynx dev
  server's `3000` — and offers everything it finds in one picker, labelling each
  target with the integration it belongs to. A port that is not listening is
  skipped, and the selected target is opened on the dev server it was found on.
  Passing `--port` still queries that one port only.

- [#457](https://github.com/callstackincubator/rozenite/pull/457) [`3a29044`](https://github.com/callstackincubator/rozenite/commit/3a29044d0b72354ff80cb2e044afe7d51b800348) Thanks [@V3RON](https://github.com/V3RON)! - Every official plugin now declares the integrations it supports, so a plugin that cannot work in the environment you are debugging can say so instead of loading and failing.

  Controls, Feature Flags, React Hook Form and TanStack Query import nothing from `react-native` on the device and declare every integration, Lynx included. Plugins built on native modules — SQLite, Storage, File System and Performance Monitor — declare React Native only, and so do Network Activity and Require Profiler: `react-native-web` provides no `TurboModuleRegistry` or `DevSettings`, which their device code calls. The rest use React Native APIs that do have web equivalents, and also declare Rozenite for Web.

- [#472](https://github.com/callstackincubator/rozenite/pull/472) [`312fd97`](https://github.com/callstackincubator/rozenite/commit/312fd9769daa6f357a0027efe825b55cd956145c) Thanks [@V3RON](https://github.com/V3RON)! - Make the React agent domain answer render-performance questions in one call, and
  cut the noise out of component-tree reads.

  - `getComponentRenders` aggregates a whole profiling session into one row per
    component — render count, total/average/max render time, and why it rendered —
    so "what was slow" and "what re-rendered too often" no longer mean paging
    `getRenderData` once per commit.
  - `getProfileTimeline` lists every commit with its duration and rendered-fiber
    count, chronologically or slowest first, and stays queryable after
    `stopProfiling`.
  - `getErrors` lists the components React logged errors or warnings against;
    those counts now appear on ordinary tree and node reads too.
  - `getTree`, `getChildren`, and `searchNodes` accept `noHost: true`, which hides
    plain host components and promotes their children to the nearest visible
    ancestor. Off by default, and largely a safety net: React DevTools already
    hides host components at the backend, so they rarely reach the tree at all.
  - `getComponent`, `getProps`, `getState`, and `getHooks` accept `maxValueLength`
    (default 512) so a single base64 or serialized-blob prop cannot dominate a
    response.

- [#444](https://github.com/callstackincubator/rozenite/pull/444) [`be13ccc`](https://github.com/callstackincubator/rozenite/commit/be13ccc5a02c9593cfb1c81b6e1b67efc3a02e93) Thanks [@V3RON](https://github.com/V3RON)! - Add Rozenite for Lynx. `@rozenite/lynx` installs the device runtime in a Lynx app's background thread, and `@rozenite/lynx-dev` adds an rspeedy plugin that serves the Rozenite standalone app and bridges Lynx's DebugRouter transport to the inspector protocol the app already speaks — so the same panels, plugin catalogue and CLI work against a Lynx app with no DevTools-side changes. `@rozenite/middleware` gains an `integration` option that skips its React Native lookups, and `@rozenite/plugin-bridge` now runs in Lynx's background runtime. Every plugin's React Native entry point used to treat any runtime without a `window` as a server and quietly install a no-op, which disabled all of them on Lynx; each now also checks for Lynx's `lynx` binding, and asking for a client on Lynx's main-thread runtime fails with an `UnsupportedPlatformError` rather than a `TypeError`.

- [#433](https://github.com/callstackincubator/rozenite/pull/433) [`c5a3cfc`](https://github.com/callstackincubator/rozenite/commit/c5a3cfc90abd6347ab0321590f7ca262896a1465) Thanks [@V3RON](https://github.com/V3RON)! - Add `rozenite agent tap`, a CLI command that streams a Rozenite Agent session's plugin messages to stdout in both directions, without opening a browser or React Native DevTools. `--plugin` filters the stream to one plugin; `--type` and `--payload` send one message before watching, so a plugin's native side can be poked and its response observed directly from the terminal. Pass `--json` for newline-delimited JSON output.

  Because a device serves only one debugger connection at a time, a tap rides the same connection `rozenite agent` uses and replaces React Native DevTools if it is already attached, the same tradeoff `rozenite agent` already makes.

- [#444](https://github.com/callstackincubator/rozenite/pull/444) [`be13ccc`](https://github.com/callstackincubator/rozenite/commit/be13ccc5a02c9593cfb1c81b6e1b67efc3a02e93) Thanks [@V3RON](https://github.com/V3RON)! - Offer every debuggable page of a device, not just one. A device can host several runtimes — every Lynx card is one, and a React Native app gains a page per extra VM — but target discovery collapsed each device to a single page, so the rest were unreachable. In LynxExplorer the surviving page was always its own home screen, which contains no Rozenite, so a developer's card could not be opened at all. Each page is now its own target with its own id, `--deviceId` still accepts a device id (asking which card when that device has more than one), and reconnecting returns to the page being debugged instead of drifting to another one.

- [#438](https://github.com/callstackincubator/rozenite/pull/438) [`40a43df`](https://github.com/callstackincubator/rozenite/commit/40a43df8e88c65c742dd103b23bd7dbb1fc22415) Thanks [@V3RON](https://github.com/V3RON)! - Build plugin React Native, Metro and SDK entry points with `tsc` instead of Vite; Vite now builds only the DevTools panels. Metro and SDK entry points ship as CommonJS behind the `default` condition, so they can be both `require`d from a `metro.config.js` and `import`ed from a `metro.config.mjs`. `rozenite build` no longer prints build tool output unless it fails or `--verbose` is passed.

### Patch Changes

- [#444](https://github.com/callstackincubator/rozenite/pull/444) [`be13ccc`](https://github.com/callstackincubator/rozenite/commit/be13ccc5a02c9593cfb1c81b6e1b67efc3a02e93) Thanks [@V3RON](https://github.com/V3RON)! - Keep looking for Lynx devices after the dev server starts. Device discovery ran once, with a three-second budget, and the connector only watches clients on devices it already knows — so a device missed in that window stayed invisible, with an empty target list and nothing logged, until the dev server was restarted. It now retries on a timer, which also covers plugging a device in or booting an emulator while the dev server is already running.

- Updated dependencies [[`4afc448`](https://github.com/callstackincubator/rozenite/commit/4afc448f9e7dae4736155f173b7d726e31458d08), [`a1f5280`](https://github.com/callstackincubator/rozenite/commit/a1f5280e785e3db34b23b0877d52ad19c831dc88), [`312fd97`](https://github.com/callstackincubator/rozenite/commit/312fd9769daa6f357a0027efe825b55cd956145c), [`c5a3cfc`](https://github.com/callstackincubator/rozenite/commit/c5a3cfc90abd6347ab0321590f7ca262896a1465)]:
  - @rozenite/tools@2.3.0
  - @rozenite/agent-shared@2.3.0
  - @rozenite/agent-sdk@2.3.0

## 2.2.0

### Minor Changes

- [#422](https://github.com/callstackincubator/rozenite/pull/422) [`2d9ad00`](https://github.com/callstackincubator/rozenite/commit/2d9ad00a225663d300bddc7cd4236f3665443bcb) Thanks [@V3RON](https://github.com/V3RON)! - Add a standalone Rozenite app that runs the DevTools panel UI in its own browser window instead of inside React Native DevTools. Run `rozenite open` to pick a connected device and open it. Because panels live outside the DevTools frontend, they stay mounted across a JS-VM reload instead of being torn down and recreated — the app reconnects to the device in the background while your panels keep their state.

  The standalone app is opt-in and connects directly to the device, so it competes with React Native DevTools and `rozenite agent` for the same debugger connection; only one can be attached at a time.

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-sdk@2.2.0
  - @rozenite/agent-shared@2.2.0
  - @rozenite/tools@2.2.0

## 2.1.0

### Minor Changes

- [#382](https://github.com/callstackincubator/rozenite/pull/382) [`55369c4`](https://github.com/callstackincubator/rozenite/commit/55369c4c54c7c2d548fb38472e3907797e938bc9) Thanks [@V3RON](https://github.com/V3RON)! - Restructure Rozenite for Agents skills so the CLI bundles all content and the installable skill becomes a thin router. Add `rozenite skills list` and `rozenite skills show <id>` to list and read the bundled docs (ground truths, CLI workflow, SDK workflow, SDK code patterns, and one doc per agent-enabled domain). The `rozenite-agent` and `rozenite-agent-sdk` skills are replaced by a single `rozenite` skill that discovers docs through `rozenite skills` instead of hardcoding them, so the skill can no longer go stale.

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-sdk@2.1.0
  - @rozenite/agent-shared@2.1.0
  - @rozenite/tools@2.1.0

## 2.0.0

### Major Changes

- [#335](https://github.com/callstackincubator/rozenite/pull/335) [`a57b914`](https://github.com/callstackincubator/rozenite/commit/a57b91448e6cc9b88bd987bf462f07deef6b0d55) Thanks [@V3RON](https://github.com/V3RON)! - Expose globally qualified tool names, descriptions, and optional safety traits
  in agent CLI tool discovery. Agent tool contracts now support `readOnly`,
  `destructive`, and `idempotent` metadata.

- [#322](https://github.com/callstackincubator/rozenite/pull/322) [`fa96bb8`](https://github.com/callstackincubator/rozenite/commit/fa96bb84d53d264b1f30aa7034ec678711a2c6b1) Thanks [@V3RON](https://github.com/V3RON)! - Change agent CLI row-shaped output to the stable columnar `cols` / `rows`
  contract for two or more rows. Terminal pagination envelopes are removed, and
  additional pages now provide a runnable `next` command instead of a bare
  cursor. Paginated tools now declare their stable row fields through a reusable
  shared contract, re-exported from `@rozenite/agent-bridge`, so built-in and
  third-party plugins receive the same output behavior without CLI allowlists.

- [#333](https://github.com/callstackincubator/rozenite/pull/333) [`f20d89d`](https://github.com/callstackincubator/rozenite/commit/f20d89d6f0f75fe364b7e7a3b6e76db7e2b3f77a) Thanks [@V3RON](https://github.com/V3RON)! - Remove SDK and CLI auto-pagination so every tool invocation performs exactly
  one call and preserves plugin-owned page results and cursors unchanged. Fetch
  additional pages by passing the returned cursor explicitly.

### Minor Changes

- [#328](https://github.com/callstackincubator/rozenite/pull/328) [`dc8b4ea`](https://github.com/callstackincubator/rozenite/commit/dc8b4eacbab70b871a02bdd93e0611a400b92ae2) Thanks [@V3RON](https://github.com/V3RON)! - Derive short, stable agent domain names from npm package names instead of mangled, hash-suffixed slugs. `@rozenite/mmkv-plugin` now resolves to the domain `mmkv` instead of `at-rozenite__mmkv-plugin`, and `@avasapp/rozenite-plugin-ably` resolves to `avasapp/ably`. The domain name is a pure function of the plugin's package name alone — installing, removing, or updating other plugins never changes it, and two packages that would derive the same domain name now fail loudly instead of one silently shadowing the other.

  The previous mangled slug form (e.g. `at-rozenite__mmkv-plugin`) is still accepted by `resolveDomainToken` as an undocumented compatibility alias for one release cycle.

### Patch Changes

- [#321](https://github.com/callstackincubator/rozenite/pull/321) [`94941d2`](https://github.com/callstackincubator/rozenite/commit/94941d23af5cb99077a41a8c6e405edffccd2467) Thanks [@V3RON](https://github.com/V3RON)! - Agent sessions now automatically recover after an app relaunch while keeping their session ID and restoring tools. If a relaunch interrupts profiling or recording, Rozenite reports the lost data instead of returning a misleading empty result.

- [#359](https://github.com/callstackincubator/rozenite/pull/359) [`6ab6fbe`](https://github.com/callstackincubator/rozenite/commit/6ab6fbee1b214b7d42c7a5434bcb909a59d9ffbe) Thanks [@V3RON](https://github.com/V3RON)! - Improve plugin build times by running independent build targets concurrently while preserving all generated outputs.

- [#326](https://github.com/callstackincubator/rozenite/pull/326) [`cdd656b`](https://github.com/callstackincubator/rozenite/commit/cdd656bac330240543d6626c6e13bb2b0c3dd2a4) Thanks [@V3RON](https://github.com/V3RON)! - Fix `react.stopProfiling` agent tool returning an empty success result instead of erroring when called with no active profiling session. It now throws `No active profiling session for this session`, matching the guard used by the other stop-style agent tools (`network.stopRecording`, `performance.stopTrace`, `memory.stopSampling`).

- Updated dependencies [[`a57b914`](https://github.com/callstackincubator/rozenite/commit/a57b91448e6cc9b88bd987bf462f07deef6b0d55), [`fa96bb8`](https://github.com/callstackincubator/rozenite/commit/fa96bb84d53d264b1f30aa7034ec678711a2c6b1), [`f20d89d`](https://github.com/callstackincubator/rozenite/commit/f20d89d6f0f75fe364b7e7a3b6e76db7e2b3f77a), [`dc8b4ea`](https://github.com/callstackincubator/rozenite/commit/dc8b4eacbab70b871a02bdd93e0611a400b92ae2)]:
  - @rozenite/agent-sdk@2.0.0
  - @rozenite/agent-shared@2.0.0
  - @rozenite/tools@2.0.0

## 1.13.0

### Patch Changes

- [#307](https://github.com/callstackincubator/rozenite/pull/307) [`7b00844`](https://github.com/callstackincubator/rozenite/commit/7b00844e6439bb7447bc2b61519a6aa6fc1c270f) Thanks [@V3RON](https://github.com/V3RON)! - Derive the Agent debugger WebSocket `Origin` from the selected inspector URL and default local Agent connections to `127.0.0.1` so React Native origin checks accept Rozenite for Agents sessions.

- [#306](https://github.com/callstackincubator/rozenite/pull/306) [`7b41dad`](https://github.com/callstackincubator/rozenite/commit/7b41dad5d54fcb342693059c48af3976213a9a2d) Thanks [@V3RON](https://github.com/V3RON)! - Add `getComponent` to the React agent so inspected component data can be fetched from a live session.

- [#304](https://github.com/callstackincubator/rozenite/pull/304) [`58c98ec`](https://github.com/callstackincubator/rozenite/commit/58c98ece9fd470396ed32687cdd069a8b558e927) Thanks [@V3RON](https://github.com/V3RON)! - Add `getTree` to the React agent so the current tree can be fetched and paged from the live app.

- [#305](https://github.com/callstackincubator/rozenite/pull/305) [`ec6224f`](https://github.com/callstackincubator/rozenite/commit/ec6224ffa45647c184717d08f7c8826af42683f0) Thanks [@V3RON](https://github.com/V3RON)! - Add stable React component labels so nodes can be looked up by labels like `@c2` across the React agent tools.

- Updated dependencies [[`7b00844`](https://github.com/callstackincubator/rozenite/commit/7b00844e6439bb7447bc2b61519a6aa6fc1c270f)]:
  - @rozenite/agent-shared@1.13.0
  - @rozenite/agent-sdk@1.13.0
  - @rozenite/tools@1.13.0

## 1.12.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-sdk@1.12.0
  - @rozenite/agent-shared@1.12.0
  - @rozenite/tools@1.12.0

## 1.11.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-sdk@1.11.0
  - @rozenite/agent-shared@1.11.0
  - @rozenite/tools@1.11.0

## 1.10.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-sdk@1.10.0
  - @rozenite/agent-shared@1.10.0
  - @rozenite/tools@1.10.0

## 1.9.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-sdk@1.9.0
  - @rozenite/agent-shared@1.9.0
  - @rozenite/tools@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-sdk@1.8.1
  - @rozenite/agent-shared@1.8.1
  - @rozenite/tools@1.8.1

## 1.8.0

### Minor Changes

- [#222](https://github.com/callstackincubator/rozenite/pull/222) [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a) Thanks [@manapard](https://github.com/manapard)! - Add plugin `./sdk` entrypoints for typed agent tool descriptors backed by the
  same tool contracts used at runtime.

  The storage plugin now ships `@rozenite/storage-plugin/sdk` with typed
  `storageTools` descriptors and shared tool contract exports, and the Rozenite
  build pipeline now bundles per-target SDK declarations so plugin SDK entrypoints
  publish clean `dist/sdk/index.d.ts` files.

- [#222](https://github.com/callstackincubator/rozenite/pull/222) [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a) Thanks [@manapard](https://github.com/manapard)! - Add the first public Agent SDK for programmatic Rozenite agent workflows.

  The SDK now exposes `createAgentClient()` with `client.withSession(...)`,
  `client.openSession()`, and `client.attachSession()` for session-scoped work,
  plus `session.domains.*` and `session.tools.*` helpers for dynamic or
  descriptor-based tool calls.

  A new `@rozenite/agent-sdk/transport` subpath exposes the low-level HTTP
  transport used by the CLI, and the docs and packaged skills now include a
  dedicated `rozenite-agent-sdk` workflow.

### Patch Changes

- Updated dependencies [[`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a), [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a)]:
  - @rozenite/agent-sdk@1.8.0
  - @rozenite/agent-shared@1.8.0
  - @rozenite/tools@1.8.0

## 1.7.0

### Minor Changes

- [#216](https://github.com/callstackincubator/rozenite/pull/216) [`a826e35`](https://github.com/callstackincubator/rozenite/commit/a826e35ffadcf79b9d2f1bb033666d3b27d40752) Thanks [@V3RON](https://github.com/V3RON)! - Refactor the agent workflow to use Metro-backed session routes and shared transport types instead of the old daemon-oriented CLI flow.

  The agent bridge now re-registers in-app tools after session bootstrap, middleware waits for session bootstrap before exposing created sessions, and the packaged CLI skill/docs were updated to match the new session and artifact behavior.

### Patch Changes

- [#212](https://github.com/callstackincubator/rozenite/pull/212) [`83269e6`](https://github.com/callstackincubator/rozenite/commit/83269e6719e02776d654f7c111755c164870d44d) Thanks [@V3RON](https://github.com/V3RON)! - Restructure plugin packaging so build outputs are grouped under target-specific `dist/devtools`, `dist/react-native`, and `dist/metro` directories.

  The CLI now keeps builder-managed `package.json` entry fields in sync with generated outputs, React Native `require()` chunks use stable names, and public declaration files are bundled per target entry.

- Updated dependencies [[`a826e35`](https://github.com/callstackincubator/rozenite/commit/a826e35ffadcf79b9d2f1bb033666d3b27d40752)]:
  - @rozenite/agent-shared@1.7.0
  - @rozenite/tools@1.7.0

## 1.6.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/tools@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/tools@1.5.1

## 1.5.0

### Minor Changes

- [#190](https://github.com/callstackincubator/rozenite/pull/190) [`5ae53a4`](https://github.com/callstackincubator/rozenite/commit/5ae53a4b509adbd8536ea24812f7ca523a95b625) Thanks [@V3RON](https://github.com/V3RON)! - Added Rozenite for Agents, including the new CLI agent workflow, shared agent packages, and middleware support for the new agent connection flow.

### Patch Changes

- Updated dependencies []:
  - @rozenite/tools@1.5.0

## 1.4.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/tools@1.4.0

## 1.3.0

### Minor Changes

- [#171](https://github.com/callstackincubator/rozenite/pull/171) Thanks [@dannyhw](https://github.com/dannyhw)! - Plugin templates were updated to use updated dependencies.

### Patch Changes

- Updated dependencies []:
  - @rozenite/tools@1.3.0
