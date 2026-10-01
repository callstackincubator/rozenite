# Network Activity on-device regression suite

The suite in `apps/playground/e2e/network-activity/` drives the running
playground through the Agent SDK, runs every network scenario inside the
app, and compares what `@rozenite/network-activity-plugin` emitted against
stored snapshots. The design is in
[ADR 0002](../adr/0002-network-activity-on-device-regression-harness.md); it
guards the capture rewrite in [ADR 0001](../adr/0001-xhr-first-network-capture.md).

It is **not run in CI** (CI has no simulator) and is not part of `pnpm test`
or Turborepo. Run it by hand, or from a sub-agent, before review of any
change to the plugin's capture code.

## Prerequisites

- The playground is built and running on a booted **iPhone simulator**, with
  Rozenite installed. Follow [e2e-testing.md](./e2e-testing.md) to build it
  (`pnpm expo run:ios` from `apps/playground`) and to confirm Rozenite is
  installed.
- Metro is running from the repository root with `pnpm start:playground`.
- Workspace packages are built (`pnpm turbo run build --filter=@rozenite/playground...`).
- **React Native DevTools is closed.** Opening DevTools for the app can end
  the suite's agent session: the inspector proxy disconnects the earlier
  debugger when a new one attaches. Do the panel smoke check (below) as a
  separate step.
- Port `38383` is free on the host; the suite starts its fixture server
  there. Nothing else needs to be started by hand.

## Run it

Before every compare run, rebuild the plugin and reload the app. The app
loads `@rozenite/network-activity-plugin` from its `dist` (there is no
development export condition for it), so without this step the suite tests
whatever was built last:

```bash
pnpm turbo run build --filter=@rozenite/network-activity-plugin
# then reload the app (press r in the Metro terminal)
```

Then, from the repository root:

```bash
pnpm --filter @rozenite/playground e2e:network
```

Run one scenario with Vitest's name filter, e.g.
`pnpm --filter @rozenite/playground e2e:network -t fetch-get-json`.

`e2e:network` compares against the recorded baselines and runs Vitest with
`CI=1`, so a missing snapshot is a failure, not a new baseline.

Setup stops in `beforeAll` within seconds, naming the missing piece, when:
Metro is down; no app is connected; several devices are connected and
`ROZENITE_DEVICE_ID` is unset; the app has not registered
`app.run-network-scenario` or the plugin's agent tools within 15 s (so the
plugin hook is not mounted, or the bundle is stale; reload it); the app's
scenario list differs from the suite's (reload the app); the app cannot
reach the fixture server within 3 s; the app's `Platform.OS` differs from
`ROZENITE_E2E_PLATFORM`; no baselines exist for the platform; or the plugin
is being observed differently from how the baselines were recorded (see
below). It never waits on a device that is not there.

## Snapshots are the wire contract

Each scenario snapshot holds two things:

- `app`: what the application observed (status, parsed JSON, echoed body,
  abort error, stream message counts). This proves the plugin did not
  disturb the app. The same outcomes are also asserted, as soft assertions,
  so a broken scenario fails the run and still records its snapshot.
- `capture`: the plugin's events for that scenario, in order, correlated by
  the `X-Rozenite-Scenario` request header (WebSockets by the `scenario`
  query parameter), followed by the `response-body` reply to
  `get-response-body`.

Before comparison the suite normalises only what is volatile: request and
socket ids become `<request-1>`/`<socket-1>`, timestamps, durations, `ttfb`
and `responseTime` become `<number>`, initiator line and column numbers
become `<number>` and bundle URL query strings `?<query>`, each request's
`request-progress` events collapse into one entry with the final
`loaded`/`total`, the fixture origin becomes `<fixture>`, multipart
boundaries become `<boundary>`, bodies over 4 KiB become a length and hash,
the Metro host and port in initiator URLs become `<metro>`, initiator stacks
keep their first three frames, and `date`, `etag`, `last-modified`, `age`,
`connection` and `keep-alive` response headers are dropped. Everything else — `source`, `type`, method,
request headers, status, `statusText`, `contentType`, `size`, bodies — is
compared verbatim.

A snapshot diff is therefore a change to what the plugin sends. Review it as
such: an intended format change updates the snapshot in the same pull
request; anything else is a regression.

Snapshots live in `apps/playground/e2e/network-activity/__snapshots__/<platform>/`,
one directory per platform because iOS and Android networking stacks differ.
Next to them, `baseline.json` records the platform and how the plugin was
observed when they were recorded.

## Record baselines

```bash
pnpm turbo run build --filter=@rozenite/network-activity-plugin
# reload the app, then:
pnpm --filter @rozenite/playground e2e:network:record
```

This runs Vitest with `--update`, rewriting every snapshot, and rewrites
`baseline.json`. Record against the implementation you want to hold the next
change to (for ADR 0001, the implementation before the rewrite), check that
every scenario passed its application assertions, and commit the
`__snapshots__` directory, `baseline.json` included. Do not record baselines
on a branch that already contains the change under test, and do not
re-record to make a failing compare run pass.

## Android

Run on a booted emulator with the platform and the host's address as the
emulator sees it:

```bash
ROZENITE_E2E_PLATFORM=android \
ROZENITE_FIXTURE_BASE_URL=http://10.0.2.2:38383 \
pnpm --filter @rozenite/playground e2e:network
```

Alternatively run `adb reverse tcp:38383 tcp:38383` and keep the default
`http://localhost:38383`. The fixture is plain HTTP, which debug builds
allow.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `ROZENITE_METRO_HOST` | `127.0.0.1` | Metro host |
| `ROZENITE_METRO_PORT` | `8081` | Metro port |
| `ROZENITE_FIXTURE_PORT` | `38383` | Port the fixture server listens on (all interfaces) |
| `ROZENITE_FIXTURE_BASE_URL` | `http://localhost:<port>` | Fixture origin as the device reaches it |
| `ROZENITE_E2E_PLATFORM` | `ios` | Snapshot directory; must equal the app's `Platform.OS` |
| `ROZENITE_E2E_RECORD` | unset | Set by `e2e:network:record`; writes `baseline.json` instead of checking it |
| `ROZENITE_DEVICE_ID` | — | Target device when several are connected |
| `ROZENITE_E2E_OBSERVER` | `auto` | `tap`, `agent-tools` or `auto` (see below) |
| `ROZENITE_E2E_CAPTURE_TIMEOUT_MS` | `10000` | How long to wait for a scenario's events |

## How the plugin is observed

Before any scenario runs, the suite opens the agent session's tap stream for
`@rozenite/network-activity-plugin` and sends `get-client-ui-settings`. A
`client-ui-settings` reply proves the tap carries plugin traffic and that
the plugin is listening, and the suite then records the plugin's raw
messages, sending `network-enable` before each scenario (so a reload
mid-run does not leave recording off). With no reply it uses the plugin's
own agent tools instead (`startRecording` before each scenario, then
`listRequests`, `getRequestDetails`, `getRequestBody`, `getResponseBody`,
`listRealtimeConnections`, `getRealtimeConnectionDetails`). It prints which
one it chose.

The two record different shapes, so snapshot names end in `tap` or
`agent-tools`, and a compare run whose mode differs from the one in
`baseline.json` fails in setup. A change that breaks the tap therefore
fails loudly instead of falling back to fresh agent-tools snapshots. Force a
mode with `ROZENITE_E2E_OBSERVER`.

A scenario whose events do not all arrive within the capture timeout is
still snapshotted, with `complete: false`, so a transport the current
implementation does not capture is recorded as such rather than blocking the
baseline.

## Pieces

- `fixture-server.ts`: deterministic endpoints (`/json`, `/text`,
  `/status/:code`, `/no-content`, `/slow?ms=`, `/png`, `/large`, `/echo`,
  `/sse`, WebSocket echo at `/ws`). Start it alone with
  `pnpm --filter @rozenite/playground e2e:network:fixture` (Node 22.18 or
  newer) to poke at it with `curl`.
- `src/app/utils/network-activity/e2e-scenarios.ts` and
  `src/app/useNetworkScenarioAgentTool.ts` in the playground: the scenarios
  and the `app.run-network-scenario` tool. The scenario names and payloads
  shared with the suite are in `e2e-scenario-contract.ts`. The `fetch-*`
  scenarios call `whatwg-fetch` directly, which is React Native's own
  XHR-backed `fetch`: in this app `globalThis.fetch` is `expo/fetch`,
  because importing `expo` replaces it unless `EXPO_PUBLIC_USE_RN_FETCH` is
  set. `global-fetch-get-json` calls `globalThis.fetch` and records which
  implementation it was.
- The agent session is shared per target. If one already exists (your own
  `rozenite agent` session), the suite uses it and leaves it running; it
  only stops a session it created.
- `fixture-server.test.ts` and `normalise.test.ts` run without a device as
  the playground's ordinary `test` script.

## DevTools panel smoke check

The panel UI is not part of the suite. Keep one manual check, as a separate
step after the suite has finished, through `agent-browser` as described in
[e2e-testing.md](./e2e-testing.md): open React Native DevTools, select the
Network Activity panel so it is recording, trigger requests from the
playground's Network screen (`rozenite://network`, GET and POST for each
transport), and confirm the panel lists them. Do not run the suite or other
`rozenite agent` sessions while DevTools is open; each new debugger
connection can close the previous one.
