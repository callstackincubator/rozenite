# Rozenite roadmap ideas

Ranked idea list for making Rozenite the go-to DevTools platform for React Native, Web,
and Lynx. Compiled from the existing plugins, open/closed issues and PRs, and the current
platform architecture (plugin-bridge messaging + RPC, `@rozenite/ui`, agent domains,
Metro/Re.Pack/Vite integrations). Each idea was checked for feasibility against the
JS-only plugin architecture and for overlap with what already exists or is tracked.

Within each section, strongest first.

## Top 5 overall

1. List & virtualization inspector plugin (new)
2. Reload-resilient plugin sessions as a framework primitive (core)
3. Console / Logs plugin (#427) and JS errors plugin (#384) — already tracked, highest-value pair
4. Network plugin: mocking, throttling, GraphQL and HAR (features)
5. Integration parity matrix: make more official plugins work on Web and Lynx (core)

---

## New plugins

### 1. List & virtualization inspector (`@rozenite/list-inspector-plugin`)

- **What**: Instruments `FlatList` / `SectionList` / FlashList / LegendList via a
  device-side wrapper (HOC or `useListInspector` hook, adapter per library). Panel shows,
  per list: blank-area events while scrolling, per-item render counts and durations,
  duplicate/unstable keys, `renderItem` identity changes across renders (the classic
  "inline closure kills memoization" bug), viewability churn, and list config
  (windowSize, initialNumToRender, estimatedItemSize) with lint-style hints.
- **Why**: List performance is the single most common RN performance complaint, and no
  DevTools panel exists for it anywhere (Shopify's FlashList profiling hooks exist but
  have no UI). This would be a unique, headline-grabbing plugin. Also relevant on Web.
- **Feasibility**: ✅ Pure JS. FlashList already exposes `useBlankAreaTracker`/
  `onBlankArea`; for FlatList, blank-cell detection can be approximated from viewability +
  render timing, and key/identity checks are simple wrappers. Follows the proven adapter
  pattern (storage, sqlite, feature-flags). UI needs are covered by `VirtualizedDataTable`
  and the new `VirtualizedList` (PR #442). Agent domain: `list-issues` /
  `get-list-stats` gives agents a perf assertion primitive.
- **Risk**: wrapping must be opt-in per list (a Babel auto-instrumentation could come
  later, similar to require-profiler's approach).

### 2. Console / Logs plugin — endorse and prioritize #427

Already fully specced by the team. Strictly better console (persistent ring buffer,
correct symbolicated call sites, structured logs, query bar, export). The needed UI
primitives (`VirtualizedList`, `ToggleGroup`, `QueryField`) are landing in PR #442, so it
is now unblocked. Strongest tracked idea; listed here for ranking completeness.

### 3. JS errors plugin — endorse #384

Persistent, deduplicated, agent-queryable error history (global handler + unhandled
rejections + error-boundary helper, Metro symbolication). Pairs with #427; the
`list-errors` agent tool is the missing post-condition check for agent-driven flows.

### 4. i18n / localization plugin (`@rozenite/i18n-plugin`)

- **What**: Adapter-based (i18next first, then react-intl/lingui): live locale switching
  from DevTools, table of loaded namespaces/keys, missing-key feed (i18next emits
  `missingKey` events), pseudo-localization toggle to catch clipped layouts, and
  "highlight untranslated strings" mode.
- **Why**: Every production app localizes; today debugging means grepping JSON files and
  rebuilding. No RN devtool covers this. Works identically on RN, Web, Lynx (pure JS).
- **Feasibility**: ✅ i18next's public API covers everything (`changeLanguage`,
  `missingKey` event, resource introspection). Same adapter pattern as feature-flags.

### 5. Environment / device info plugin — endorse #385

Already tracked. One panel with device, app, JS engine, and dev-server facts. Cheap to
build; also the natural home for an AppState/lifecycle timeline (foreground/background,
memory warnings, dimension/orientation changes — all available from public JS APIs).

### 6. Expo Updates / OTA inspector (`@rozenite/expo-updates-plugin`)

- **What**: Shows current update ID, channel, runtime version, embedded vs downloaded
  state; buttons to check/fetch/reload; log of update events.
- **Why**: OTA misconfiguration is a common, painful class of bugs ("why is my update not
  applying?"), and `expo-updates` state is invisible today.
- **Feasibility**: ✅ `expo-updates` exposes all of it via public JS API
  (`Updates.checkForUpdateAsync`, `useUpdates()`, event listeners). Expo-only by nature —
  fits the integration-declaration work in #455/#457.

### 7. Zustand / MobX state inspector — verify before building

Zustand's `devtools` middleware speaks the Redux DevTools extension protocol, so it may
already work with `@rozenite/redux-devtools-plugin`. **Action**: verify, then document
("works with Zustand/Jotai via devtools middleware") before considering a dedicated
plugin. Documentation may capture 80% of the value for free.

### Considered and deliberately not ranked

- **Re-render/React profiler plugin** — overlaps with the React DevTools Profiler already
  embedded in RN DevTools; only worth doing with a differentiated scope (persisted,
  agent-queryable commit history).
- **Reanimated/animation inspector** — worklets run on the UI thread; JS-only capture
  can't see them without library cooperation. Revisit with the Reanimated team.
- **Accessibility auditor** — valuable but needs host-tree traversal that the JS-only
  plugin architecture doesn't currently offer; native inspectors (Xcode/axe) cover part
  of it. Park until there's a tree-access primitive.
- **Push-notification / permissions testers** — require native modules; out of scope for
  the production-safe JS-only model.

---

## Features for existing plugins

### 1. Network Activity: mock & throttle

Map-local response mocking (URL pattern → stubbed status/body), request breakpoints, and
latency/offline throttling. The device-side XHR/fetch/WebSocket interceptors are already
in place, so responding locally or delaying resolution is an incremental step. This turns
the panel from read-only into a testing tool — the top request in every network-tool
category. Agent tools (`mock-request`, `set-network-conditions`) let agents test error
paths deterministically.

### 2. Network Activity: GraphQL awareness + HAR export

Parse request bodies for `operationName`/`query` and render an operations view (no Apollo
coupling — pure payload parsing). Export/import HAR for bug reports and CI artifacts;
import gives the panel replay value. Both are small, well-understood additions.

### 3. Performance Monitor: zero-instrumentation defaults

Today the panel only shows what apps emit via `react-native-performance`. Add
out-of-the-box JS-thread FPS / long-task detection, startup phases, and screen-transition
timing (via an optional react-navigation integration) so the panel is useful on first
open. Feasible from JS (RAF-gap sampling, `performance` marks RN already emits).

### 4. Storage: edit-in-place and watch

Editing values directly in the panel (MMKV/AsyncStorage adapters already have write
APIs), plus "watch this key" highlighting on change. Closes the loop from inspect to
manipulate, matching what the feature-flags plugin already proved out.

### 5. SQLite: saved queries + schema browser + CSV export

Query-first is right; add a persisted query library (localStorage on the panel side), a
schema sidebar (`sqlite_master` + `PRAGMA table_info` — no new adapter surface needed),
and CSV/JSON export of result sets.

### 6. React Navigation: route render timing

Attach per-screen mount→interactive timing to the existing action timeline, giving a
"slowest screens" view. Combines the existing navigation listener with `InteractionManager`
/ perf marks; no new native surface.

### 7. Redux DevTools: action/state diff view

Show a structural diff per action instead of two full trees. Needs the `JsonDiff` UI
primitive already identified in #427's out-of-scope list — building it once serves both
plugins (and future "diff since last" in Console).

---

## Core framework features

### 1. Reload-resilient plugin sessions (standard resync primitive)

A recurring bug class: panels go stale/empty after app reload (#389 storage, #391
tanstack-query, #368 stale counts, #324 stale buffers, #317 agent session healing) — each
fixed ad hoc. Promote the fix into `@rozenite/plugin-bridge`: a standard
connect/reconnect handshake with session epochs, plus an optional device-side ring-buffer
helper so plugins replay state to a re-attached panel. Every current and future plugin
gets reload survival for free; it's also a prerequisite for #427/#384's "never lose
data" promise.

### 2. Integration parity: make official plugins truly cross-target

The declaration work (#455–#457) says *which* targets a plugin supports; the follow-up is
increasing that number. Concretely: storage, network, and console/errors on **Lynx** and
**Web** are all JS-feasible and would make "works on RN, Web, and Lynx" a real
differentiator rather than a runtime footnote. Publish the support matrix on the plugin
directory.

### 3. Shared pagination primitive — endorse #320

Cursor-based pagination for device→panel data transfer, needed by storage (#338 perf),
sqlite, network bodies, and the future console/list-inspector plugins. One primitive,
five consumers; also the fix for large-dataset freezes.

### 4. Fix astral/emoji message corruption — #407

Host→device messages containing emoji are silently dropped. A silent data-loss bug in the
core transport undermines every plugin; small, high-leverage fix.

### 5. Declarative plugin authoring — endorse RFC #402

Generated dev/production entries and an enforced UI/RN boundary lower the floor for
community plugins. Community plugin volume is the long-term moat; this plus plugin
version decoupling (#441) is the enabler.

### 6. In-DevTools plugin discovery

A lightweight "Discover" panel listing the plugin directory (name, description, install
command, supported targets from #455 metadata) so users find plugins where they already
are. Static metadata fetch; no marketplace mechanics needed for v1.

---

*No source changes accompany this document; validation (`checks:affected` /
`test:affected`) is not applicable to a docs-only addition.*
