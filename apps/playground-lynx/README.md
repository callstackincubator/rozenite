# @rozenite/playground-lynx

A [Lynx](https://lynxjs.org) playground app, bootstrapped with `create-rspeedy`.
It is the Lynx counterpart to `apps/playground`: a place to exercise the
Rozenite plugins that support Lynx against a real Lynx runtime.

## Getting started

From the repository root:

```bash
pnpm install
```

Then start the dev server:

```bash
pnpm --filter @rozenite/playground-lynx dev
```

The terminal prints a bundle URL and a QR code. Open the bundle in
[LynxExplorer](https://lynxjs.org/guide/start/quick-start.html): scan the QR
code on a device, or on an iOS simulator paste the printed URL into the
**Bundle URL** field and tap **Open Schema**.

Once the app connects, the dev server logs a Rozenite DevTools URL for it —
open that in a browser to get the plugin panels.

Edit `src/App.tsx` to see updates — the page hot-reloads as you save.

## Rozenite integration

- [`@rozenite/lynx-dev`](../../packages/lynx-dev) is added to
  `lynx.config.ts`. It discovers installed plugins and bridges Lynx's
  DebugRouter to the CDP dialect `@rozenite/app` speaks.
- [`@rozenite/lynx`](../../packages/lynx) is imported once in `src/index.tsx`.
  It installs the device-side dispatcher that plugins talk to, and must run
  before any plugin hook does.

## Plugins

Every official plugin that declares `lynx` in its `rozenite.config.ts`
`integrations` is installed here, with a minimal playground under
`src/plugins/`:

| Plugin                             | Playground                                                     |
| ---------------------------------- | -------------------------------------------------------------- |
| `@rozenite/controls-plugin`        | One section with a text, input, toggle, and button item          |
| `@rozenite/feature-flags-plugin`   | Two flags behind the custom adapter, with their effective values |
| `@rozenite/rhf-plugin`             | One registered, validated field                                  |
| `@rozenite/tanstack-query-plugin`  | One query the panel can inspect and refetch                      |

The remaining plugins depend on React Native or Metro internals and declare no
`lynx` integration, so they are deliberately not installed here.

Each playground renders the state it shares with its panel, so a change made in
DevTools is visible on the device without any extra tooling.
