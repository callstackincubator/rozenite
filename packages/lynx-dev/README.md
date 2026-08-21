![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### An rspeedy/Rsbuild plugin for integrating React Native DevTools plugins into your Lynx development workflow.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

`@rozenite/lynx-dev` brings Rozenite to [Lynx](https://lynxjs.org). It runs a small dev server on top of your rspeedy/Rsbuild dev server that speaks Metro's inspector dialect — `/json/list` and `/inspector/debug` — so the same `@rozenite/app` DevTools frontend React Native uses connects to a Lynx app unmodified. Underneath, it discovers Lynx apps over [DebugRouter](https://github.com/lynx-family/lynx/tree/main/devtool) and bridges DebugRouter's wire protocol to Chrome DevTools Protocol (CDP) on the fly.

## Features

- **Automatic Plugin Discovery**: discovers installed Rozenite plugins from your project's `package.json`, exactly as `@rozenite/metro` does for React Native
- **Metro-Compatible Dev Server**: serves `/json/list` and `/inspector/debug` so `@rozenite/app` needs no Lynx-specific code
- **DebugRouter Bridge**: discovers Lynx apps over USB and translates DebugRouter frames to and from CDP
- **Reload-Safe Device Ids**: a device's identity survives an app reload, so a saved DevTools tab reconnects instead of going stale
- **Express Middleware**: provides the same scoped, composable middleware shape as `@rozenite/metro`

## Installation

Install the plugin as a development dependency:

```bash
npm install --save-dev @rozenite/lynx-dev
```

Your app also needs [`@rozenite/lynx`](https://www.npmjs.com/package/@rozenite/lynx) — the small runtime that installs the device-side dispatcher Rozenite plugins talk to. Import it once at your app's entry point:

```ts
if (__DEV__) {
  require('@rozenite/lynx');
}
```

## Usage

Add the plugin to your `lynx.config.ts`:

```ts
// lynx.config.ts
import { defineConfig } from '@lynx-js/rspeedy';
import { rozeniteLynxPlugin } from '@rozenite/lynx-dev';

export default defineConfig({
  plugins: [
    // ...your other rspeedy plugins
    rozeniteLynxPlugin(),
  ],
});
```

### With Custom Options

```ts
// lynx.config.ts
import { defineConfig } from '@lynx-js/rspeedy';
import { rozeniteLynxPlugin } from '@rozenite/lynx-dev';

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
  enableAndroid?: boolean; // Discover Android devices. Default: true
  enableIOS?: boolean; // Discover iOS devices. Default: true
  enableHarmony?: boolean; // Discover HarmonyOS devices. Default: false
  enableDesktop?: boolean; // Discover desktop targets. Default: false
};
```

**Options:**

- `enabled` - Whether to enable Rozenite (optional, defaults to disabled in production builds)
- `include` - Array of package names to explicitly include (optional)
- `exclude` - Array of package names to exclude from loading (optional)
- `destroyOnDetachPlugins` - Array of package names that should be destroyed when switching panels instead of maintaining their state (optional, by default all plugins persist their state)
- `pluginDisplay` - Use `'sidebar'` (default) to show all plugin panels in one Rozenite tab, or `'tabs'` to retain a separate DevTools tab for every plugin panel
- `deviceSerial`, `enableAndroid`, `enableIOS`, `enableHarmony`, `enableDesktop` - Control which devices DebugRouter discovers

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

- Make sure `@rozenite/lynx` is imported at your app's entry point, guarded for development builds
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
[npm-downloads]: https://www.npmjs.com/package/@rozenite/lynx-dev
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
