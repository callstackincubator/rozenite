# DAEMOND

## Overview

The MCP stack now uses a local manager daemon instead of routing CLI calls through Metro-hosted MCP HTTP endpoints.

The design has three parts:

1. The CLI is short-lived.
   It parses the command, ensures the local daemon is running, sends one IPC request over a Unix socket, prints the response, and exits.

2. The daemon is long-lived.
   It is scoped to one workspace, owns the Unix socket, and manages all active MCP sessions for that workspace.

3. A session is long-lived and isolated.
   One session maps to one React Native device target and one persistent CDP websocket connection. Session state is memory-only and disappears when the daemon exits.

## Why This Exists

The previous MCP flow made each CLI invocation depend on Metro middleware as the MCP authority. That worked for simple request-response calls, but it made long-lived state, reconnection, and accumulated inspection data awkward because the CLI had no persistent control plane of its own.

The daemon/session model fixes that by moving MCP authority to a local process that can:

- keep a CDP websocket open over time
- accumulate in-memory inspection state across many CLI calls
- reconnect when the device connection drops
- preserve a stable session identity while the CLI remains stateless

## Process Model

### CLI

- User-facing entrypoint: `rozenite mcp ...`
- Talks only to the local daemon over a Unix socket or named pipe
- Does not keep live websocket state

### Manager Daemon

- One daemon per workspace
- Started on demand by `rozenite mcp session create`
- Stores metadata such as pid, workspace, socket path, start time, and active sessions
- Hosts many sessions, but sessions do not communicate with each other

### Session

- One session per device target
- Owns:
  - target/device metadata
  - one persistent `/inspector/debug` websocket
  - tool registry for that device
  - pending tool calls
  - console buffer state
  - React inspection/profiling state
  - reconnect/bootstrap state

## Transport and Control Plane

### CLI to Daemon

- Transport: Unix socket on POSIX, named pipe on Windows
- Protocol: newline-delimited JSON RPC-style requests and responses
- Core methods:
  - `daemon.health`
  - `metro.targets`
  - `session.create`
  - `session.list`
  - `session.show`
  - `session.stop`
  - `session.tools`
  - `session.call-tool`

### Daemon to React Native / Metro

- Target discovery comes from Metro `GET /json/list`
- Session transport uses the target's `webSocketDebuggerUrl`
- The daemon connects directly to the CDP websocket instead of calling Metro MCP HTTP routes

## Runtime Bridge

The daemon reuses the Rozenite runtime messaging model already used by the debugger frontend.

Key points:

- The session enables `Runtime` on the CDP connection.
- It discovers the binding name from `__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__`.
- It registers a runtime binding with `Runtime.addBinding`.
- It initializes the `rozenite` and `react-devtools` domains by evaluating `initializeDomain(...)`.
- It sends messages back into the runtime with `Runtime.evaluate` and `sendMessage(...)`.
- It receives messages from the runtime through `Runtime.bindingCalled`.

This preserves the existing Rozenite device-side protocol while moving ownership of the transport to the daemon.

## State Ownership

The daemon reuses MCP state logic from the middleware package instead of reimplementing it from scratch.

That reused logic includes:

- tool registration and routing
- console log storage and pagination
- React tree inspection and profiling stores
- pending tool-call resolution

The difference is where the live device connection sits:

- before: Metro middleware owned the device connection and served MCP over HTTP
- now: the daemon owns the device connection and exposes MCP over local IPC

## Reconnection Model

Sessions are expected to survive transient connection loss.

When a websocket closes:

- the session is marked disconnected
- pending tool calls are rejected
- reconnect is scheduled
- on reconnect, the session re-runs the runtime bootstrap flow
- runtime-visible tool state is rebuilt from the live device

The session identity remains stable during reconnects.

## Persistence Model

Persistence is intentionally memory-only.

- Session state survives across many CLI invocations
- Session state does not survive daemon shutdown or restart
- No disk-backed restore is attempted

This keeps the first version simple while still providing the main benefit: long-lived state across short-lived CLI commands.

## Command Model

Sessions are explicit.

Typical flow:

1. `rozenite mcp targets --json`
2. `rozenite mcp session create --deviceId <id> --json`
3. `rozenite mcp domains --session <sessionId> --json`
4. `rozenite mcp <domain> tools|schema|call --session <sessionId> ...`

Domain/tool commands require `--session` so routing is always explicit and never hidden behind an implicit default.

## Design Tradeoffs

The architecture intentionally prefers:

- one manager daemon per workspace over one process per session
- explicit sessions over implicit auto-selection
- local IPC over localhost HTTP
- memory-only state over disk persistence
- direct CDP ownership over Metro-hosted MCP request handling

That gives a single control plane for the workspace, isolated session state, and fewer moving parts at the CLI boundary.
