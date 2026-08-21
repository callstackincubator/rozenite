---
'@rozenite/agent-shared': minor
'@rozenite/middleware': minor
'@rozenite/agent-sdk': minor
'@rozenite/lynx-dev': minor
'rozenite': minor
---

Teach Rozenite for Agents which built-in domains the connected target can
actually back, so a Lynx session no longer looks like a React Native one.

The five built-in domains were designed against React Native's CDP surface, and
Lynx exposes a different one: it registers no `Network` domain at all, has no
React DevTools backend, and implements a Perfetto-based `Tracing` domain that
shares Chrome's method names but not its protocol. Until now every session
advertised all five regardless, so an agent on a Lynx target could only find out
by calling — and two of the three ways that fails are silent. `network` errored
with a raw protocol code, `react` returned nothing, `performance` finalised a
trace artifact containing zero events, and heap sampling appeared to start and
collected nothing.

Each session now resolves a capability profile from its target's platform.
Unsupported tools are never registered, so `list-tools` is honest; unavailable
domains stay visible in `rozenite agent domains` with an `availability` column, a
reason, and — for `network` — the `@rozenite/network-activity-plugin` domain to
use instead. Calling an unsupported tool fails during resolution with that same
explanation rather than a protocol error, so the agent gets a next step instead
of a dead end. On Lynx that means `console`, plugin domains, app tools and
`memory.takeHeapSnapshot` are reported supported, `memory` is degraded, and
`network`, `react` and `performance` are unavailable with reasons.

Three fixes to the CDP command channel apply to every platform, not just Lynx. A
device error now names the method it refused instead of arriving as a stringified
error object; waits on a device event are bounded, so a capture whose completion
event never arrives fails with a diagnosis instead of hanging forever; and
`stopTrace` refuses to hand back an empty trace artifact rather than reporting a
successful capture of nothing.

Both new fields on the session tools response are optional, so a CLI and a Metro
on different versions keep working together — an older server simply reports no
capability data and every domain is treated as supported, exactly as before.
