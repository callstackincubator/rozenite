# Playground testing and navigation

- The playground (`apps/playground`) is a showcase and E2E testing ground for
  Rozenite DevTools plugins. Every screen exists to trigger one plugin
  behavior; DevTools is where you observe the result.
- Follow `docs/agents/e2e-testing.md` to reach the app, confirm Rozenite is
  installed on the simulator, and open React Native DevTools.
- DevTools UI is a normal web page — agents can read and interact with it the
  same way they interact with the app.

## Navigate by deep link

Use `rozenite://<path>` with `agent-device` (`open_url`) or `xcrun simctl
openurl booted "rozenite://<path>"`. Every screen is reachable this way —
see `apps/playground/src/app/navigation/routes.ts` for the source of truth.

The scheme is `rozenite://`, matching `expo.scheme` in `app.json`. Do not use
`playground://`: that scheme is registered by an unrelated app that is commonly
installed on the same simulator, so iOS routes those links to it instead. If a
deep link appears to open the wrong app, confirm the bundle id under test is
`com.callstackcincubator.rozenite`.

| Route | Deep link | Title |
| --- | --- | --- |
| Home | `rozenite://` | Rozenite Playground |
| ControlsPlugin | `rozenite://controls` | Controls |
| ReduxTest | `rozenite://redux` | Redux |
| StoragePlugin | `rozenite://storage` | Storage |
| FeatureFlagsPlugin | `rozenite://feature-flags` | Feature Flags |
| FileSystemTest | `rozenite://file-system` | File System |
| NetworkTest | `rozenite://network` | Network Activity |
| RequestBodyTest | `rozenite://network/request-body` | Request Body |
| PerformanceMonitor | `rozenite://performance/monitor` | Performance Monitor |
| RequireProfilerTest | `rozenite://performance/require-profiler` | Require Profiler |
| PerfProblem | `rozenite://performance/perf-problem` | Perf Problem |
| ReactHookFormPlugin | `rozenite://forms` | React Hook Form |
| BottomTabs (Home tab) | `rozenite://navigation` | React Navigation Demo |
| BottomTabs (Profile tab) | `rozenite://navigation/profile` | React Navigation Demo |
| BottomTabs (Settings tab) | `rozenite://navigation/tab-settings` | React Navigation Demo |
| ParameterDisplay | `rozenite://navigation/parameter-display` | Parameter Display |
| SuccessiveScreensStack | `rozenite://navigation/successive` | Successive Screens |
| Settings | `rozenite://settings` | Settings |

## Navigate by semantics

Prefer `agent-device` driving the iOS AXSnapshot over coordinates:

- Every interactive element has a stable `accessibilityLabel` — use it to
  find and tap the element, never a screen coordinate.
- List rows on the home index and inside Storage/File System have
  `accessibilityRole="button"` and a label naming the destination (e.g.
  "Controls plugin"), not a position.
- Tabs (`SegmentedTabs`) have `accessibilityRole="tab"` and
  `accessibilityState.selected`.
- Switches have `accessibilityRole="switch"` and `accessibilityState.checked`.
- Screen and section titles have `accessibilityRole="header"`.
- Observable results render as `KeyValueRow`: one accessible node per row
  with `accessibilityLabel` set to the key and `accessibilityValue.text` set
  to the value — read these instead of parsing rendered text.

## Route ↔ deep link ↔ accessibility label

| Route | Deep link path | Home-index accessibility label |
| --- | --- | --- |
| Home | `` | Rozenite Playground home |
| ControlsPlugin | `controls` | Controls plugin |
| ReduxTest | `redux` | Redux DevTools demo |
| StoragePlugin | `storage` | Storage plugin |
| FeatureFlagsPlugin | `feature-flags` | Feature flags plugin |
| FileSystemTest | `file-system` | File system plugin |
| NetworkTest | `network` | Network activity plugin |
| PerformanceMonitor | `performance/monitor` | Performance monitor plugin |
| RequireProfilerTest | `performance/require-profiler` | Require profiler plugin |
| PerfProblem | `performance/perf-problem` | Performance problem demo |
| ReactHookFormPlugin | `forms` | React Hook Form plugin |
| BottomTabs | `navigation` | React Navigation demo |
| Settings | `settings` | Playground settings |

(`RequestBodyTest`, `ParameterDisplay`, and `SuccessiveScreensStack` are
reached from within their parent screen, not from the home index.)

## Trigger / observe per plugin

| Plugin | Trigger | Observe |
| --- | --- | --- |
| Controls | Toggle a switch, edit the release label, or press an action button on the Controls screen | Controls panel in DevTools |
| Redux | Press `+1` / `-1` / `Reset` on either counter card | Redux DevTools panel — switch instances to see both stores |
| Storage | Set/Delete a key on the MMKV, Async, or Secure tab | Storage panel in DevTools |
| Feature Flags | Press Refresh on the Feature Flags screen, or set/clear an override from the Feature Flags panel in DevTools | Feature Flags panel in DevTools; the checkout banner, welcome message, retry count, and card styling on the Feature Flags screen react to the effective value |
| File System | Save or remove the react logo PNG | File System panel in DevTools |
| Network Activity | Pick a transport (`fetch`/`expo`/`nitro`) and press GET/POST/Slow/Abort/Download, or connect the WebSocket/SSE section | Network panel in DevTools |
| Performance Monitor | Fire a metric, mark, measure, or network request | Performance Monitor panel in DevTools |
| Require Profiler | Press "Require heavy computation module" | Require Profiler panel in DevTools |
| React Hook Form | Edit the profile form fields | RHF panel in DevTools (form id `profile-form`) |
| React Navigation | Navigate between tabs / push successive screens | React Navigation panel in DevTools |
| SQLite | Native only — inspect the seeded `app`/`analytics`/`testing`/`binary` databases | SQLite panel in DevTools |
| TanStack Query | Any Network Activity fetch also populates the query cache from boot-time calls in `src/main.tsx` | TanStack Query panel in DevTools |
| Overlay | Always mounted via `<RozeniteOverlay />` | Overlay panel in DevTools |
| Agent tools | Call `show-alert`, `random-number`, or `echo-payload` from an MCP client | Agent tool call result |
