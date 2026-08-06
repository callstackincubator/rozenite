# rozenite

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
