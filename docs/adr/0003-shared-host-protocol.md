# 0003 — One definition of the Rozenite host protocol

**Status:** Accepted — not yet implemented

**Related:** [callstackincubator/rozenite#521](https://github.com/callstackincubator/rozenite/issues/521)

## Context

Rozenite reaches a device's JS runtime over the Fusebox flavour of the Chrome
DevTools Protocol. A *host* is the side that opens that connection and drives
the Rozenite handshake:

1. Wait until `__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__` exists on the device.
2. Read its `BINDING_NAME`, call `Runtime.addBinding`, evaluate
   `initializeDomain('rozenite')`.
3. Exchange messages: device → host as `Runtime.bindingCalled` events whose
   `payload` is `JSON.stringify({ domain, message })`; host → device by
   evaluating `__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.sendMessage(domain, "<json>")`.
4. Re-run the handshake when the `main` execution context is recreated, and
   react to the bracketed close reasons (`[RECREATING_DEVICE]`,
   `[PAGE_NOT_FOUND]`, `[CONNECTION_LOST]`, `[NEW_DEBUGGER_OPENED]`) the
   inspector proxy closes the socket with.

Three hosts implement this independently:

| Host | File | Transport |
|---|---|---|
| `@rozenite/runtime` (embedded in React Native DevTools) | `src/rn-devtools/bindings-model.ts` | DevTools frontend SDK |
| `@rozenite/app` (standalone app) | `src/connection/device-connection.ts` | browser `WebSocket` |
| `@rozenite/middleware` (agent sessions) | `src/agent/session.ts` | Node `ws` |

One more party produces what those hosts consume: the Lynx dev-server bridge
in `@rozenite/lynx/rspeedy` answers `Runtime.addBinding` locally, synthesises
`Runtime.bindingCalled`, renames the background context to `main`, and closes
sockets with the same bracketed reasons. Producer and consumers share no code;
each side re-declares the strings.

The copies have drifted. The middleware has no command timeout and retries a
failed bootstrap forever, while the app gives up with a "Rozenite missing"
state. Readiness checks accept different values. One encoding bug (non-BMP
characters in host → device messages, #505) had to be fixed three times by
hand.

[ADR 0000](./0000-single-target-discovery-endpoint.md) solved a similar
problem for target discovery by moving the logic behind one server endpoint
instead of sharing a module. That is not available here: the protocol runs on
the connection itself, inside each host, and two of the hosts (runtime and
app) run in a browser with a direct socket to the device.

## Decision

1. **The wire contract is defined once, in `@rozenite/tools/protocol`.** A new
   subpath of `@rozenite/tools`, built like `@rozenite/tools/integration`:
   no imports, no Node or DOM globals, safe to inline into the runtime's
   single-file `host.js`, the browser app, Node, and the Lynx bridge. It
   holds:
   - the protocol constants (dispatcher global name, binding name, domain
     names, `main` context name, close reasons, handshake timings);
   - close-reason classification (recoverable / taken by another debugger /
     terminal);
   - the pure builders and parsers for both directions: the host → device
     `sendMessage` and `initializeDomain` expressions (including the ASCII
     escaping from #505), the dispatcher-ready and binding-name expressions,
     the `Runtime.bindingCalled` parser, and the `Runtime.bindingCalled`
     builder the Lynx bridge uses;
   - the `/json/list` page shape that the Lynx bridge produces and the
     middleware's discovery consumes.

   `@rozenite/tools` is used because every party that needs the contract
   (runtime, app, middleware, lynx) already depends on it, so this adds no
   dependency edge anywhere. A new package is not created.

2. **The handshake logic is shared too, behind an injected transport.** A
   transport-agnostic bootstrap (wait for dispatcher → binding name →
   `addBinding` → `initializeDomain`, plus re-bootstrap on context
   recreation) lives next to the contract and takes `evaluate` /
   `addBinding` functions from the host. Each host keeps what is genuinely
   its own: socket lifecycle, recovery UI or healing state, send queueing,
   origin headers, and which domains it initialises (the agent session also
   initialises `react-devtools`). The app and middleware adopt it first, the
   runtime last, through an adapter over the frontend SDK.

3. **The wire format does not change.** Device-side packages
   (`@rozenite/plugin-bridge`, `@rozenite/lynx`'s runtime, `@rozenite/web`)
   ship in the user's app; hosts ship with the dev server. Even with all
   `@rozenite/*` packages versioned in lockstep, the two can be out of step
   in practice (a stale bundle, several copies in a monorepo). Every string,
   expression and event the shared module produces must be byte-identical
   to what the copies produce today. Golden tests in `@rozenite/tools` pin
   them before any host switches over.

4. **Behaviour changes are separate from the extraction.** Where the hosts
   disagree, the fix is made on its own and reviewed as a behaviour change.
   The extraction that follows is a pure refactor.

5. **The device-side dispatcher is out of scope.** `@rozenite/web` vendors
   React Native's `setUpFuseboxReactDevToolsDispatcher.js` verbatim so it
   can be diffed against upstream, and `@rozenite/lynx` keeps its fork with a
   different send path. Sharing them would mean a new runtime dependency for
   code Metro compiles inside user apps, for about sixty lines of savings.

6. **Agent contracts stay in `@rozenite/agent-shared`; bundler wiring stays
   in `@rozenite/middleware`.** Agent-only duplicates (pagination limits and
   types, error-detail formatting, the targets envelope unwrap, message-type
   constants, built-in tool names) move into `@rozenite/agent-shared`, which
   must remain browser-safe. The option forwarding from Metro, Re.Pack and
   Lynx to `initializeRozenite` becomes one helper in `@rozenite/middleware`
   that copies only known `RozeniteConfig` fields.

## Consequences

- A protocol fix is made once and reaches every host. Adding a host means
  writing a transport, not re-deriving the handshake.
- The Lynx bridge and the hosts import the same constants, so a renamed close
  reason or context name breaks the build rather than a connection.
- `@rozenite/tools/protocol` inherits the constraints of
  `@rozenite/tools/integration`: no imports and no platform globals
  (`ReturnType<typeof setTimeout>`, not `NodeJS.Timeout`; no `Buffer`). It
  is inlined into `host.js`, so it stays small.
- Tests that mock a host's private protocol module by path (for example the
  middleware session test's mock of `agent/runtime/bindings.js`) move to the
  shared module or keep a re-export at the old path.
- `@rozenite/plugin-bridge` keeps declaring the dispatcher global and the
  `rozenite` domain name itself, because it depends only on `tslib` and
  ships in user apps. If it ever needs the shared contract, that is the point
  to move the contract into a dependency-free package of its own.
