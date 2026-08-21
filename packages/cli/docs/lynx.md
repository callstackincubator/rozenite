---
name: lynx
description: What changes when the agent session target is a Lynx app rather than React Native — which built-in domains work, which do not, and what to use instead.
platforms: lynx
---

# Lynx targets

Rozenite for Agents works against Lynx apps, but the five built-in domains
were designed against React Native's CDP surface and Lynx exposes a
different one. Everything else — sessions, plugin domains, app-defined
tools, `tap` — behaves the same.

Check first, do not assume:

```sh
npx rozenite agent domains --session <sessionId>
```

The `availability` column is authoritative for the connected target. The
table below is what it will say on Lynx today.

## What works

- **`console`** — fully supported. Lynx emits the same console and log
  events Rozenite captures.
- **Plugin and app domains** — fully supported. Plugin tools travel over
  Rozenite's own device channel, not over the CDP domains that differ, so
  a plugin that works on React Native works here.
- **`memory.takeHeapSnapshot`** — supported. The rest of the `memory`
  domain is not; see below.

## What does not

- **`network`** — unsupported. Lynx has no CDP `Network` domain, so no
  amount of retrying will help. Use `@rozenite/network-activity-plugin`
  instead; it is the documented fallback and it works on Lynx.
- **`react`** — unsupported. There is no React DevTools backend on Lynx,
  so there is no component tree to read and no substitute domain. Read
  structure from source, and get runtime state from plugin domains.
- **`performance`** — unsupported. Lynx has a `Tracing` domain, but it is
  Perfetto-based rather than Chrome-based: the same name, a different
  protocol. Rozenite reports it unsupported rather than handing back a
  trace artifact that looks valid and contains nothing. Capture Lynx
  traces with Lynx DevTool.
- **`memory.startSampling` / `memory.stopSampling`** — unsupported. Lynx's
  JS engine implements heap snapshots but not allocation sampling, so
  `memory` is reported `degraded` and these two tools are absent from its
  `list-tools` output.

## How unsupported tools fail

Calling one fails immediately, at resolution, with the reason and — where
one exists — the domain to use instead. That error is the answer: act on
it rather than retrying, and never work around a missing built-in domain
by inventing instrumentation in the app.

An unsupported domain still appears in `domains` output. It is listed so
the gap is visible, not because it can be used.
