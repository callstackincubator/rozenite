# 0000 — One Rozenite endpoint for debug-target discovery

**Status:** Accepted

**Related:** [callstackincubator/rozenite#482](https://github.com/callstackincubator/rozenite/issues/482)

## Context

A "target" is one debuggable runtime (a page in Chrome DevTools Protocol
terms) on one connected device. Every host integration exposes the list of
targets through the CDP-style `GET /json/list` endpoint: Metro's inspector
proxy serves it for React Native, and `@rozenite/lynx-dev` synthesises an
identical shape for Lynx (`packages/lynx-dev/src/server/json-list.ts`).

Turning that raw page list into the targets Rozenite offers is not a plain
mapping. The rules (group pages by `logicalDeviceId`, drop Metro's legacy
duplicate of a Fusebox page, keep genuinely separate runtimes such as Lynx
cards and Reanimated worklet VMs, order deterministically) were implemented
three times, once per transport:

| Copy | Transport |
|---|---|
| `packages/middleware/src/agent/metro-discovery.ts` | `node:http`, behind `GET /rozenite/agent/targets` |
| `packages/cli/src/commands/metro-discovery.ts` | global `fetch`, used by `rozenite open` |
| `packages/app/src/connection/metro-target-resolution.ts` | browser `fetch`, used to re-resolve a target after a disconnect |

The copies had already drifted: only two of them keep every runtime of a
device, only the app copy knows to go back to the page that was being
debugged, and each produces its own "dev server unreachable" message.

Beyond the duplication, `/json/list` carries only what CDP defines. Rozenite
wants to attach its own facts to a target. The first is which integration
(`react-native` or `lynx`) serves it. Today the CLI derives that from the
port it scanned, which is a guess; a `--port` chosen by the user carries no
integration at all.

The endpoint for this already exists. `GET /rozenite/agent/targets`, served
by `@rozenite/middleware`, requests `/json/list` from the hosting dev server,
applies the selection rules, and returns `MetroTarget[]`. Because the Lynx
dev-server plugin mounts the full middleware under `/rozenite`, the same
route is already reachable on both integrations, and the middleware already
knows which integration it hosts (`RozeniteConfig.integration`). The Agent
SDK has consumed this route since it was introduced.

Not every way of running Rozenite discovers targets:

- **Injected into React Native DevTools (Fusebox).** React Native builds the
  DevTools URL itself, and Rozenite only rewrites where the frontend is
  loaded from. `@rozenite/runtime` rides the frontend's existing CDP target
  and never lists targets.
- **Standalone `@rozenite/app`, in a browser tab or in the Electron shell.**
  The initial target comes from the `?ws=…&appId=…` query built by whoever
  opened the app (`rozenite open`, or the Lynx dev server's log line). The
  app itself lists targets only when re-resolving after a recoverable
  disconnect, and only from its own origin.
- **`rozenite open`.** Lists targets on each dev server it scans, then
  launches the app with the URL above.
- **`@rozenite/web`.** Its `handleOpenDebugger` fetches `/json/list` on
  purpose to reproduce the React Native CLI's key-command behaviour, not
  Rozenite's rules.

## Decision

1. **`GET /rozenite/agent/targets` is the only way Rozenite code discovers
   targets.** The `/json/list` endpoint of the hosting dev server is an
   implementation detail of the middleware. No other Rozenite package reads
   it, with the single exception of `@rozenite/web`'s `handleOpenDebugger`,
   which is deliberately mimicking React Native's own CLI and is out of
   scope.

2. **The selection rules live in `@rozenite/middleware` only.** The CLI and
   app copies are deleted, not extracted to a shared package. A shared
   module of pure functions would have solved the drift but not the
   extensibility problem, since every consumer would still parse
   `/json/list` itself.

3. **The middleware keeps producing targets by calling the hosting dev
   server's `/json/list`.** For React Native that is Metro's inspector proxy;
   for Lynx it is `@rozenite/lynx-dev`'s own implementation on the same
   server. Lynx does not get a separate in-process path. How the middleware
   resolves the host and port of that call (from the request's `Host`
   header, `packages/middleware/src/agent/routes.ts`) is unchanged by this
   decision.

4. **Each target gains an `integration` field** of type
   `RozeniteHostIntegration` (`'react-native' | 'lynx'`), set from the
   middleware's own `RozeniteConfig.integration`. Consumers must read it
   from the response and must not derive it from a port. Further
   Rozenite-specific properties are added the same way, on the target
   object, in the middleware's single mapper.

5. **The response shape is the existing agent envelope**,
   `{ ok: true, result: { targets: MetroTarget[] } }` on success and
   `{ ok: false, error: { message } }` on failure, with the types exported
   from `@rozenite/agent-shared`. The `MetroTarget` name is kept for now to
   avoid a rename across every consumer; it describes a target of any
   integration.

6. **Consumers of the endpoint:**
   - `rozenite open` requests it from every dev server it scans, and labels
     the picker from `integration`. The list of default ports to scan stays
     in the CLI; ports say where to look, the response says what was found.
   - `@rozenite/app` requests it from `window.location.origin` when
     re-resolving after a disconnect, filters on `deviceId`, prefers the
     target whose `pageId` matches the page it was debugging, and otherwise
     takes the first target, which the endpoint already returns in
     preference order.
   - `@rozenite/agent-sdk` continues to use it unchanged.

7. **The CLI and the middleware are released in lockstep and expected to
   match.** The CLI does not fall back to `/json/list` when the endpoint is
   missing; an older middleware surfaces as the endpoint's error, like every
   other version mismatch between the two.

## Consequences

- One implementation of target selection, exercised by every consumer, so a
  rule fixed once is fixed everywhere and a new target property is a
  one-place change.
- `@rozenite/app` depends on `@rozenite/agent-shared` for the route constant
  and response types. That package is browser-safe (types and pure
  functions, no Node imports), which is a property it must keep.
- The app's reconnect gains the "keep every separate runtime" rule it was
  missing, and the "go back to the same page" rule becomes a lookup on
  `pageId` instead of parsing `webSocketDebuggerUrl`.
- The CLI no longer needs any knowledge of the `/json/list` shape, and its
  unreachable-server message comes from the endpoint's error, or from the
  transport failure when the server is not listening at all.
- The Lynx dev server needs no change: its `/json/list` and the mounted
  middleware already compose into the endpoint.
- Discovery in the app is one extra hop (browser → middleware → dev server
  → middleware → browser) instead of one. Both legs are on the same host,
  and the path runs only on reconnect, so the cost is not measurable.
- Cross-origin use of the endpoint is not covered. Every consumer today is
  either same-origin or a Node process, so the middleware sets no CORS
  headers. A Rozenite UI served from another origin would need a follow-up
  decision.
