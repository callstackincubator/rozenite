![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### Rozenite for Lynx: one package for the device runtime and the rspeedy/Rsbuild dev-server plugin.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

`@rozenite/lynx` brings Rozenite to [Lynx](https://lynxjs.org). It has two
entry points:

- **`@rozenite/lynx`** (this package's default export) — the small
  device-side runtime that installs the global
  [`@rozenite/plugin-bridge`](https://www.npmjs.com/package/@rozenite/plugin-bridge)
  talks to on the device.
- **`@rozenite/lynx/rspeedy`** — an rspeedy/Rsbuild plugin that runs a small
  dev server on top of your rspeedy/Rsbuild dev server, speaking Metro's
  inspector dialect (`/json/list` and `/inspector/debug`) so the same
  `@rozenite/app` DevTools frontend React Native uses connects to a Lynx app
  unmodified. Underneath, it discovers Lynx apps over
  [DebugRouter](https://github.com/lynx-family/lynx/tree/main/devtool) and
  bridges DebugRouter's wire protocol to Chrome DevTools Protocol (CDP) on
  the fly.

You only ever install this one package. **The plugin installs the device
runtime for you** — see [How the runtime gets into your app](#how-the-runtime-gets-into-your-app)
below — so there is nothing to import by hand in your app's own source.

## Features

- **One package, one install**: no separate dev/device split to keep in sync
- **Zero manual wiring**: the plugin injects the device runtime for you, only in development — there is nothing to import, and so nothing to get wrong
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

That's the whole setup — no changes to `src/index.tsx` or any other app
source are needed.

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
runtime this package publishes at its `.` export — so it is bundled ahead of
your app's own entry point automatically, satisfying the one ordering rule
that matters: it must install `__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__` before
any plugin's `useRozeniteDevToolsClient` runs.

This only happens in development. The plugin's `setup` — where the injection
runs — never executes during `rspeedy build` (Rsbuild only calls a plugin
whose `apply` matches the current action, and this plugin declares
`apply: 'serve'`), and is additionally gated by an `enabled` option that
defaults to off whenever `NODE_ENV === 'production'`. Both guards would have
to be defeated at once for the runtime to reach a production bundle, and
neither is something your app's code can accidentally get wrong — there is
no import for you to place correctly or forget.

If you need the device runtime outside of that automatic wiring — for
example, a non-rspeedy build pipeline — you can still import it directly,
guarded for development:

```ts
if (__DEV__) {
  require('@rozenite/lynx');
}
```

Do **not** import `@rozenite/lynx` unguarded at your app's entry point. An
unguarded `import '@rozenite/lynx'` ships the dispatcher (and the code that
installs it) into your production bundle, since nothing about a static,
side-effectful import can be stripped by the bundler on its own.

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
};
```

**Options:**

- `enabled` - Whether to enable Rozenite (optional, defaults to disabled in production builds)
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
- Check that `enabled` was not explicitly set to `false`, and that you are not running a production build (`rozeniteLynxPlugin` never runs during `rspeedy build`)

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
