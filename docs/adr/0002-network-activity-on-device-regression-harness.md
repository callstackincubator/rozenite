# 0002 — On-device regression harness for Network Activity

**Status:** Accepted

**Related:** [0001](./0001-xhr-first-network-capture.md) (the rewrite this
harness guards)

## Context

The network interceptors in `@rozenite/network-activity-plugin` only mean
something on a real React Native runtime: Hermes, RN's `XMLHttpRequest`
over the native networking module, Expo's native `fetch`, and
`react-native-nitro-fetch`'s Nitro module. Unit tests for them mock nearly
all of that (`http/__tests__/fetch-interceptor.test.ts` fakes the Expo
module, the global alias and the responses), which `docs/agents/unit-testing.md`
says to avoid. Nothing today checks that an interceptor leaves application
behaviour intact, for example that `response.json()` still works after the
plugin cloned the response, or that an aborted request still rejects with an
abort error. That is exactly the class of regression a rewrite can introduce.

The existing end-to-end approach (`docs/agents/e2e-testing.md`) has a
sub-agent open React Native DevTools in a browser and click through the
playground's Network screen against public services such as
`jsonplaceholder.typicode.com` and `httpbin.org`. It is slow, flaky and
cannot assert on the exact events the plugin emits.

Pieces that already exist and make a better harness cheap:

- `@rozenite/agent-sdk` opens an agent session against a running Metro and
  calls tools by domain and name without a DevTools frontend.
- The playground registers in-app tools with `useRozeniteInAppAgentTool`
  from `@rozenite/agent-bridge`, callable as `app.<name>`.
- `@rozenite/middleware`'s agent session tees every `rozenite`-domain
  plugin message, in both directions, into a tap stream, and can inject a
  message into the same channel. That is the plugin's raw wire traffic.
- The plugin's own agent tools (`listRequests`, `getRequestDetails`,
  `getResponseBody`, `listRealtimeConnections`) read the same inspector
  events and work in an agent session.

## Decision

1. **The harness is a Node test suite that drives the running playground
   through the Agent SDK.** It lives in `apps/playground/e2e/network-activity/`
   with its own Vitest config and a package script, and is not part of the
   Turborepo `test` task, because it needs a built playground on a
   simulator or device and a running Metro. It is run on demand, by a
   person or a sub-agent, and its runbook lives in
   `docs/agents/network-activity-e2e.md`.

2. **Scenarios run inside the app through one in-app tool,
   `app.run-network-scenario`,** registered by the playground with
   arguments `{ scenario, baseUrl }`. The handler runs the named scenario
   and returns what the application observed: status, body length or
   parsed JSON, the error message for abort and timeout cases, and message
   counts for streams. No deep links, taps or screen navigation are
   involved.

3. **Requests go to a fixture server the test run starts,** reachable from
   the simulator on localhost. It serves deterministic endpoints: JSON,
   text, one endpoint per status class, 204, a delayed response, a
   redirect, a PNG, a large octet-stream with `Content-Length` for
   progress, an echo endpoint that returns the received method, headers and
   body, a WebSocket echo and an SSE stream. Public services are not used.

4. **The scenario set covers every transport and body kind the plugin
   supports:** built-in `fetch` GET, POST JSON, FormData, Blob and
   ArrayBuffer bodies, abort, timeout, 204, redirect, PNG, large download,
   Axios GET and POST (Axios is added to the playground as the reference
   XHR client), `expo/fetch` GET and abort, nitro GET, POST and abort,
   WebSocket echo, and SSE. Each scenario exists in the playground only
   for the harness and the existing Network screen is unchanged.

5. **Assertions have two targets.** The tool result proves the app was not
   disturbed. The plugin's emitted events prove the capture: the test taps
   `@rozenite/network-activity-plugin`, sends `network-enable`, calls the
   scenario, waits for `request-completed` or `request-failed` for every
   request the tool reported, requests bodies with `get-response-body`,
   and compares the ordered event list against a stored snapshot. Volatile
   fields (request ids, socket ids, timestamps, durations, time to first
   byte, initiator line and column numbers, progress event counts) are
   normalised before comparison. If the tap turns out not to carry plugin
   traffic in an agent session, the fallback is the plugin's agent tools,
   and the snapshot shape follows those tools' results instead.

6. **Baselines are recorded against the implementation that exists before
   the rewrite** and committed with the harness, in a pull request that
   precedes the rewrite. The rewrite is judged by reproducing them; a
   deliberate difference is reviewed as a snapshot change in the rewrite's
   diff.

7. **The DevTools panel keeps one smoke check,** run through
   `agent-browser` per `docs/agents/e2e-testing.md`, confirming the panel
   lists requests from the recorded session. The UI is not otherwise part of
   this harness.

## Consequences

- The rewrite in ADR 0001 has a contract to hit: same events, same order,
  same normalised payloads, same application-side outcomes, on every
  transport.
- A sub-agent's job for network end-to-end work reduces to getting the
  playground and Metro up and running one command, on iOS or Android
  alike.
- The playground gains a dev dependency on Axios and a scenario module it
  does not show in its UI.
- The harness cannot run in the repository's CI, which has no simulator; it
  guards pull requests by being run before review, and the runbook says so.
- Snapshots encode the current wire format. A future change to
  `HttpEventMap` updates them on purpose, which is the intended review
  signal.
