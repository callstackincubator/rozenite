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
- Metro is running from the repository root with `pnpm start:playground`,
  and the app has loaded the current bundle (reload it after pulling).
- Workspace packages are built (`pnpm turbo run build --filter=@rozenite/playground...`).
- Port `38383` is free on the host; the suite starts its fixture server
  there. Nothing else needs to be started by hand.

## Run it

From the repository root:

```bash
pnpm --filter @rozenite/playground e2e:network
```

Run one scenario with Vitest's name filter, e.g.
`pnpm --filter @rozenite/playground e2e:network -t fetch-get-json`.

When Metro or the app is unreachable the suite stops in its `beforeAll`
within seconds and names the missing piece (Metro down, no connected app,
several devices, or a playground that does not register
`app.run-network-scenario` yet — reload it). It never waits on a device that
is not there.

## Snapshots are the wire contract

Each scenario snapshot holds two things:

- `app`: what the application observed (status, parsed JSON, echoed body,
  abort error, stream message counts). This proves the plugin did not
  disturb the app.
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
and `date`, `etag`, `last-modified`, `age`, `connection` and `keep-alive`
response headers are dropped. Everything else — `source`, `type`, method,
request headers, status, `statusText`, `contentType`, `size`, bodies — is
compared verbatim.

A snapshot diff is therefore a change to what the plugin sends. Review it as
such: an intended format change updates the snapshot in the same pull
request; anything else is a regression.

Snapshots live in `apps/playground/e2e/network-activity/__snapshots__/<platform>/`,
one directory per platform because iOS and Android networking stacks differ.

## Record or update baselines

Missing snapshots are written on the first run. To rewrite existing ones:

```bash
pnpm --filter @rozenite/playground e2e:network -u
```

Record baselines against the implementation you want to hold the next change
to (for ADR 0001, the implementation before the rewrite), check every
scenario passed its application assertions, and commit the `__snapshots__`
directory. Do not record baselines on a branch that already contains the
change under test.

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
| `ROZENITE_E2E_PLATFORM` | `ios` | Snapshot directory |
| `ROZENITE_DEVICE_ID` | — | Target device when several are connected |
| `ROZENITE_E2E_OBSERVER` | `auto` | `tap`, `agent-tools` or `auto` (see below) |
| `ROZENITE_E2E_CAPTURE_TIMEOUT_MS` | `10000` | How long to wait for a scenario's events |

## How the plugin is observed

By default the suite opens the agent session's tap stream for
`@rozenite/network-activity-plugin`, sends `network-enable`, and records the
plugin's raw messages. If the tap carries no plugin traffic at all during
the first scenario, it falls back to the plugin's own agent tools
(`startRecording`, `listRequests`, `getRequestDetails`, `getResponseBody`,
`listRealtimeConnections`, `getRealtimeConnectionDetails`), re-runs that
scenario, and uses them for the rest of the run. It prints which one it
chose. Snapshot names end in `tap` or `agent-tools`, because the two record
different shapes; baselines recorded with one are not compared with the
other. Force a mode with `ROZENITE_E2E_OBSERVER`.

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
  shared with the suite are in `e2e-scenario-contract.ts`.
- `fixture-server.test.ts` and `normalise.test.ts` run without a device as
  the playground's ordinary `test` script.

## DevTools panel smoke check

The panel UI is not part of the suite. Keep one manual check, run through
`agent-browser` as described in [e2e-testing.md](./e2e-testing.md): open
React Native DevTools, select the Network Activity panel so it is recording,
then run the suite (or one scenario with `-t`) and confirm the panel lists
the requests to the fixture origin.
