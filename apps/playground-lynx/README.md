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

- [`@rozenite/lynx/rspeedy`](../../packages/lynx) is added to
  `lynx.config.ts`. It discovers installed plugins, bridges Lynx's
  DebugRouter to the CDP dialect `@rozenite/app` speaks, injects the
  device-side dispatcher plugins talk to, and guards every build --
  `rspeedy build` included -- against plugin code reaching a production
  bundle.
- `src/App.tsx` renders `<Rozenite />` (`@rozenite/lynx`'s default export)
  once, unconditionally, exactly where the plugin playgrounds below used to
  render directly. In development this redirects to
  [`rozenite.dev/`](./rozenite.dev); in production it resolves to a shipped
  noop.

## Plugins

Every official plugin that declares `lynx` in its `rozenite.config.ts`
`integrations` is installed here, with a minimal playground under
[`rozenite.dev/`](./rozenite.dev) -- never in app source, so the resolver
guard above can prove none of it reaches a release build:

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
