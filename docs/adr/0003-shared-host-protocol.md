# 0003 — One definition of the Rozenite host protocol

**Status:** Accepted — not yet implemented

**Related:** [callstackincubator/rozenite#521](https://github.com/callstackincubator/rozenite/issues/521)

## Context

Rozenite reaches a device's JS runtime over the Fusebox flavour of the Chrome
DevTools Protocol, through the dev server's inspector proxy. A *host* is the
side that holds such a CDP socket and drives the Rozenite handshake:

1. Enable `ReactNativeApplication` and `Runtime` (app and middleware; the
   runtime rides a socket React Native DevTools has already set up).
2. Wait until `__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__` exists on the device.
   The runtime and app then evaluate `IS_WEB_TARGET_EXPRESSION` to tell a
   browser target from a native one; the middleware does not.
3. Read the dispatcher's `BINDING_NAME` from the device, call
   `Runtime.addBinding`, and call the dispatcher's `initializeDomain` for
   `rozenite`.
4. Exchange messages: device → host as `Runtime.bindingCalled` events whose
   `payload` is `JSON.stringify({ domain, message })`; host → device by
   evaluating `__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.sendMessage(domain, "<json>")`.
5. The app and middleware re-run steps 2–3 when the `main` execution context
   is recreated, and react to the bracketed close reasons
   (`[RECREATING_DEVICE]`, `[PAGE_NOT_FOUND]`, `[CONNECTION_LOST]`,
   `[NEW_DEBUGGER_OPENED]`) the inspector proxy closes the socket with. The
   runtime only waits for the dispatcher again; its socket belongs to the
   DevTools frontend.

Three hosts implement this independently:

| Host | File | Transport |
|---|---|---|
| `@rozenite/runtime` (embedded in React Native DevTools) | `src/rn-devtools/bindings-model.ts` | DevTools frontend SDK |
| `@rozenite/app` (standalone app) | `src/connection/device-connection.ts` | browser `WebSocket` |
| `@rozenite/middleware` (agent sessions) | `src/agent/session.ts` | Node `ws` |

Two more parties produce what those hosts consume, and share no code with
them:

- The Lynx dev-server bridge in `@rozenite/lynx/rspeedy` answers
  `Runtime.addBinding` and `ReactNativeApplication.enable` locally,
  synthesises `ReactNativeApplication.metadataUpdated`,
  `Runtime.bindingCalled` and, after a context clear,
  `Runtime.executionContextCreated`, renames the background context to
  `main`, and closes sockets with the same bracketed reasons.
- `@rozenite/chrome-extension` renames the default execution context to
  `main` and speaks for `ReactNativeApplication`.

Each side re-declares the strings it shares with the other.

The copies have drifted. The middleware has no command timeout and retries a
failed bootstrap forever, while the app gives up with a "Rozenite missing"
state. Readiness checks accept different values. The runtime quotes the
domain name with single quotes in its evaluated expressions; the app and
middleware use double quotes. One encoding bug (non-BMP characters in host →
device messages, #505) had to be fixed three times by hand.

[ADR 0000](./0000-single-target-discovery-endpoint.md) solved a similar
problem for target discovery by moving the logic behind one server endpoint
instead of sharing a module. That is not available here: the protocol runs on
each host's own CDP socket, and two of the hosts (runtime and app) run in a
browser, so no server-side endpoint sits in the message path.

## Decision

1. **The wire contract is defined once, in `@rozenite/tools/protocol`.** A new
   subpath of `@rozenite/tools`, built like `@rozenite/tools/integration`.
   It holds:
   - the protocol constants: dispatcher global name, domain names, `main`
     context name, close reasons, handshake timings, and the binding name the
     Lynx bridge reports (hosts keep reading `BINDING_NAME` from the device);
   - close-reason classification (recoverable / taken by another debugger /
     terminal);
   - pure builders for the host → device expressions: `sendMessage` and
     `initializeDomain` (including the ASCII escaping from #505), the
     dispatcher-ready and binding-name expressions;
   - a payload parser (`payload` string → `{ domain, message }`) with a
     wrapper for raw `Runtime.bindingCalled` frames, and the matching
     `Runtime.bindingCalled` builder the Lynx bridge uses. Filtering by
     binding name stays with each host.

   `@rozenite/tools` is used because the hosts and the Lynx bridge (runtime,
   app, middleware, lynx) already depend on it, so this adds no dependency
   edge among published packages. The private Chrome extension gains a
   build-time dependency if it adopts the shared constants. A new package
   is not created.

   The subpath may import only `@rozenite/tools`'s own import-free modules
   (for example `./integration`). It is typechecked with `types: []`, an
   ES-only `lib` and a minimal ambient declaration of `setTimeout` and
   `clearTimeout` (the only host globals allowed), so any other Node or DOM
   global fails the build rather than leaking into the browser bundles and
   the published `.d.ts`.

2. **The `/json/list` page shape lives in `@rozenite/middleware`**, next to
   the discovery that consumes it. The Lynx bridge already imports from the
   middleware, and ADR 0000 keeps discovery there.

3. **The handshake is shared too, behind an injected transport.** A
   transport-agnostic bootstrap (steps 2–3, and re-running them on context
   recreation) lives next to the contract. The host passes `evaluate` and
   `addBinding`, a subscription to context events, and a cancellation
   signal. Each host keeps what is genuinely its own: socket lifecycle,
   recovery UI or healing state, send queueing, origin headers, and which
   domains it initialises (the agent session also initialises
   `react-devtools`). The app and middleware adopt it first. The runtime
   follows through an adapter over the frontend SDK. For the runtime that is
   a behaviour change, because it does not re-run the handshake after a
   reload today, so it is made and reviewed as one (decision 5).

4. **The wire format stays compatible.** Device-side packages
   (`@rozenite/plugin-bridge`, `@rozenite/lynx`'s runtime, `@rozenite/web`)
   ship in the user's app; hosts ship with the dev server. Even with all
   `@rozenite/*` packages versioned in lockstep, the two can be out of step
   in practice (a stale bundle, several copies in a monorepo). The shared
   module emits one canonical form: double-quoted string literals produced by
   `JSON.stringify`, which today's app and middleware already send and every
   dispatcher already evaluates. The runtime's single-quoted domain evaluates
   to the same value and moves to the canonical form. Golden tests in
   `@rozenite/tools` pin the canonical strings, expressions and events before
   any host switches over.

5. **Behaviour changes are separate from the extraction.** Where the hosts
   disagree in what they *do*, the fix is made on its own and reviewed as a
   behaviour change. The extraction that follows is a pure refactor.

6. **The device-side dispatcher is out of scope.** `@rozenite/web` vendors
   React Native's `setUpFuseboxReactDevToolsDispatcher.js` near-verbatim
   (Flow to TypeScript plus an idempotency guard) so it can be diffed against
   upstream, and `@rozenite/lynx` keeps its fork with a different send path.
   Sharing them would mean a new runtime dependency for code Metro compiles
   inside user apps, for little saving.

7. **Agent contracts stay in `@rozenite/agent-shared`; bundler wiring stays
   in `@rozenite/middleware`.** These are not part of the host protocol but
   have the same problem and are settled here to avoid a second ADR:
   - Agent-only duplicates (pagination types, error-detail formatting, the
     targets envelope unwrap, message-type constants, built-in tool names)
     move into `@rozenite/agent-shared`, which must remain browser-safe.
   - The pagination limits differ today (default 20 / max 100 in
     `agent-shared`, 50 / 200 in the middleware). They converge on 20 / 100
     as a separate behaviour change.
   - The option forwarding from Metro, Re.Pack and Lynx to
     `initializeRozenite` becomes one helper in `@rozenite/middleware` that
     copies only known `RozeniteConfig` fields. Metro and Re.Pack spread all
     options today; the extra keys they pass (`enabled`,
     `enhanceMetroConfig`) are ignored by the middleware. The helper forwards
     exactly the `RozeniteConfig` fields the middleware reads and drops the
     rest. `projectRoot` always comes from the bundler, which, unlike today's
     spread, a user option can no longer override.

## Consequences

- A protocol fix is made once and reaches every host. Adding a host means
  writing a transport, not re-deriving the handshake.
- The Lynx bridge and the hosts import the same constants, so a renamed close
  reason or context name breaks the build rather than a connection.
- `@rozenite/tools/protocol` is inlined into the runtime's single-file
  `host.js`, so it stays small. Timers in the shared bootstrap use only
  `setTimeout`/`clearTimeout`, which every host has.
- Tests that mock a host's private protocol module by path move to the shared
  module or keep a re-export at the old path: for example
  `src/__tests__/agent-session.test.ts`'s mock of
  `../agent/runtime/bindings.js` in the middleware. The app's
  `src/connection/bindings.ts` is the other private copy that goes away.
- `@rozenite/plugin-bridge` keeps declaring the dispatcher global and the
  `rozenite` domain name itself, because it depends only on `tslib` and
  ships in user apps. If it ever needs the shared contract, that is the point
  to move the contract into a dependency-free package of its own.
