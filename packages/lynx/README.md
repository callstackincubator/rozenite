![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### Rozenite for Lynx: one package for the device runtime and the rspeedy/Rsbuild dev-server plugin.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

`@rozenite/lynx` brings Rozenite to [Lynx](https://lynxjs.org). It has three
entry points:

- **`@rozenite/lynx`** (this package's default export) — the app-side seam:
  a `<Rozenite />` component you render once, unconditionally, from your app
  root. It ships a noop in production and no plugin code is ever included in
  your bundle.
- **`@rozenite/lynx/runtime`** — the device-side runtime that installs the
  global
  [`@rozenite/plugin-bridge`](https://www.npmjs.com/package/@rozenite/plugin-bridge)
  talks to on the device. You do not import this by hand; the plugin injects
  it for you (see [How the runtime gets into your app](#how-the-runtime-gets-into-your-app)
  below).
- **`@rozenite/lynx/rspeedy`** — an rspeedy/Rsbuild plugin that runs a small
  dev server on top of your rspeedy/Rsbuild dev server, speaking Metro's
  inspector dialect (`/json/list` and `/inspector/debug`) so the same
  `@rozenite/app` DevTools frontend React Native uses connects to a Lynx app
  unmodified. Underneath, it discovers Lynx apps over
  [DebugRouter](https://github.com/lynx-family/lynx/tree/main/devtool) and
  bridges DebugRouter's wire protocol to Chrome DevTools Protocol (CDP) on
  the fly. It also guards every build — `rspeedy build` included — against
  Rozenite plugin code reaching a production bundle.

## Features

- **One package, one install**: no separate dev/device split to keep in sync
- **A production guarantee, not just a convention**: `rspeedy build` fails if it resolves into a Rozenite plugin package through anything other than that plugin's declared production entry — the same guarantee `@rozenite/metro` and `@rozenite/repack` give React Native
- **Zero manual wiring for the runtime**: the plugin injects the device runtime for you, only in development — there is nothing to import, and so nothing to get wrong
- **Automatic Plugin Discovery**: discovers installed Rozenite plugins from your project's `package.json`, exactly as `@rozenite/metro` does for React Native
- **Metro-Compatible Dev Server**: serves `/json/list` and `/inspector/debug` so `@rozenite/app` needs no Lynx-specific code
- **DebugRouter Bridge**: discovers Lynx apps over USB and translates DebugRouter frames to and from CDP
- **Reload-Safe Device Ids**: a device's identity survives an app reload, so a saved DevTools tab reconnects instead of going stale
- **Express Middleware**: provides the same scoped, composable middleware shape as `@rozenite/metro`

## Installation

```bash
npm install --save-dev @rozenite/lynx
```

## Usage

Add the plugin to your `lynx.config.ts`:

```ts
// lynx.config.ts
import { defineConfig } from '@lynx-js/rspeedy';
import { rozeniteLynxPlugin } from '@rozenite/lynx/rspeedy';

export default defineConfig({
  plugins: [
    // ...your other rspeedy plugins
    rozeniteLynxPlugin(),
  ],
});
```

Then mount the seam once, unconditionally, at your app root:

```tsx
// src/App.tsx
import Rozenite from '@rozenite/lynx';

export function App() {
  return (
    <view>
      <Rozenite />
      {/* ...the rest of your app */}
    </view>
  );
}
```

Wire your plugins in a `rozenite.dev.tsx` file at your project root — never
in app source:

```tsx
// rozenite.dev.tsx
import { useRozeniteTanStackQueryDevTools } from '@rozenite/tanstack-query-plugin';

export default function RozeniteDevEntry() {
  useRozeniteTanStackQueryDevTools(/* ... */);
  return null;
}
```

In development, `rozeniteLynxPlugin()` redirects `<Rozenite />`'s internal
import to `rozenite.dev.tsx`. In production it resolves to a shipped noop
instead, and `rspeedy build` fails outright if any plugin import escaped
into app source some other way — see
[How the production guarantee works](#how-the-production-guarantee-works)
below.

### With Custom Options

```ts
// lynx.config.ts
import { defineConfig } from '@lynx-js/rspeedy';
import { rozeniteLynxPlugin } from '@rozenite/lynx/rspeedy';

export default defineConfig({
  plugins: [
    rozeniteLynxPlugin({
      include: ['@my-org/my-plugin', 'another-plugin'],
      exclude: ['unwanted-plugin'],
      destroyOnDetachPlugins: ['@rozenite/network-activity-plugin'],
      pluginDisplay: 'sidebar',
    }),
  ],
});
```

Start your rspeedy dev server as usual, plug in a Lynx app, and Rozenite will log a DevTools URL for it in the terminal as soon as it connects.

## How the runtime gets into your app

`rozeniteLynxPlugin()` appends its own device runtime to Rsbuild's
[`source.preEntry`](https://rsbuild.rs/config/source/pre-entry) — the same
runtime this package publishes at its `./runtime` export — so it is bundled
ahead of your app's own entry point automatically, satisfying the one
ordering rule that matters: it must install
`__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__` before any plugin's
`useRozeniteDevToolsClient` runs.

This only happens when the plugin is `enabled` (the default whenever
`NODE_ENV !== 'production'`) *and* the current build is not `rspeedy build`.
Both conditions are read once, up front, and gate every piece of dev-only
wiring this plugin does — there is no import for you to place correctly or
forget.

If you need the device runtime outside of that automatic wiring — for
example, a non-rspeedy build pipeline — you can still import it directly,
guarded for development:

```ts
if (__DEV__) {
  require('@rozenite/lynx/runtime');
}
```

Do **not** import `@rozenite/lynx/runtime` unguarded at your app's entry
point. An unguarded `import '@rozenite/lynx/runtime'` ships the dispatcher
(and the code that installs it) into your production bundle, since nothing
about a static, side-effectful import can be stripped by the bundler on its
own. `@rozenite/lynx`'s root export (`<Rozenite />`, the seam described
above) is the one import that is always safe to leave in app source
unconditionally.

## How the production guarantee works

`rozeniteLynxPlugin()` installs a resolver guard (`RozeniteResolverPlugin`,
shared with `@rozenite/repack` via `@rozenite/middleware`) on every build,
`rspeedy build` included — not just when the dev server runs. If a
production build resolves into a Rozenite plugin package through anything
other than that plugin's declared production entry point, the build fails,
naming the file that imported it. The same mistake only warns in
development. `allowInProduction` in `RozeniteLynxOptions` is the escape
hatch, and every package listed there is logged loudly once per build.

The guard also checks that a plugin declares Lynx support at all: a plugin
built only for React Native (or one that has not declared any target)
resolving into a Lynx bundle fails the same way, with a message naming the
integrations the plugin *does* declare.

## Configuration

### `RozeniteLynxOptions`

```typescript
type RozeniteLynxOptions = {
  enabled?: boolean; // Whether to enable Rozenite. Defaults to `process.env.NODE_ENV !== 'production'`
  include?: string[]; // Only load these specific plugins
  exclude?: string[]; // Exclude these plugins from loading
  destroyOnDetachPlugins?: string[]; // Plugins that should be destroyed when switching panels
  pluginDisplay?: 'sidebar' | 'tabs'; // How plugins are displayed in DevTools
  deviceSerial?: string; // Restrict device discovery to one physical device serial/udid
  enableAndroid?: boolean; // Discover physical Android devices over adb. Default: true
  enableIOS?: boolean; // Discover physical iOS devices over usbmux. Default: true
  enableHarmony?: boolean; // Discover physical HarmonyOS devices. Default: false
  enableDesktop?: boolean; // Discover targets on localhost, including simulators. Default: true
  allowInProduction?: string[]; // Rozenite plugin packages allowed to bypass the production guard
};
```

**Options:**

- `enabled` - Whether to enable Rozenite (optional, defaults to disabled in production builds)
- `allowInProduction` - Plugin package names allowed to bypass the production guard described in [How the production guarantee works](#how-the-production-guarantee-works) (optional; prefer declaring `productionEntries` in the plugin's `rozenite.config.ts` instead)
- `include` - Array of package names to explicitly include (optional)
- `exclude` - Array of package names to exclude from loading (optional)
- `destroyOnDetachPlugins` - Array of package names that should be destroyed when switching panels instead of maintaining their state (optional, by default all plugins persist their state)
- `pluginDisplay` - Use `'sidebar'` (default) to show all plugin panels in one Rozenite tab, or `'tabs'` to retain a separate DevTools tab for every plugin panel
- `deviceSerial`, `enableAndroid`, `enableIOS`, `enableHarmony`, `enableDesktop` - Control which devices DebugRouter discovers

`enableAndroid` and `enableIOS` cover **physical** devices only, over adb and usbmux. Simulators and emulators are ordinary processes on your machine, so DebugRouter inside them is reachable on `127.0.0.1:8901-8919` — which is what `enableDesktop` scans. That is why it defaults to on; turning it off is how you stop seeing simulators.

## Plugin Discovery

Rozenite plugins are discovered from your project's `package.json` the exact same way they are for React Native:

1. **Scanning node_modules**: Searches all node_modules directories in the project
2. **Checking for Rozenite manifest**: Looks for the Rozenite manifest file in each package
3. **Validating plugin structure**: Ensures the plugin has the required build output
4. **Loading plugin metadata**: Extracts plugin information for integration

## Plugin Requirements

For a package to be recognized as a Rozenite plugin, it must:

1. **Have a Rozenite manifest**: `dist/rozenite.json` file
2. **Be properly built**: Plugin assets must be available in the `dist` directory
3. **Follow naming conventions**: Package name should not start with `.`
4. **Be accessible**: Package must be readable from node_modules

## Troubleshooting

### No plugins found

- Ensure plugins are properly installed in `node_modules`
- Check that plugins have been built and contain `dist/rozenite.json`
- Verify plugin package names are not excluded in configuration

### No DevTools URL is logged

- Make sure the Lynx app is actually connected over USB, and DebugRouter can see it
- Check that `enabled` was not explicitly set to `false`, and that you are not running a production build (the dev server and device runtime injection never run during `rspeedy build`, though the production guard still does)

### Device reconnects but DevTools disconnects

- This is what the plugin's stable `logicalDeviceId` and reload-robustness handling exist to prevent — if it still happens, please open an issue with your Lynx SDK version and platform

## Requirements

- Node.js >= 20.19.0
- rspeedy / Rsbuild-based Lynx project
- Installed Rozenite plugins

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/lynx
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
