![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Re.Pack bundler plugin for integrating React Native DevTools plugins into your development workflow.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite Re.Pack plugin seamlessly integrates custom DevTools plugins into your React Native development environment. It automatically discovers installed plugins, serves them through Re.Pack's development server, and provides the necessary infrastructure for plugin communication and UI rendering.

## Features

- **Automatic Plugin Discovery**: Automatically finds and loads installed Rozenite plugins from node_modules
- **Re.Pack Integration**: Seamlessly integrates with Re.Pack bundler's middleware system
- **Plugin Serving**: Serves plugin assets and panels through Re.Pack's development server
- **DevTools Frontend Integration**: Patches React Native DevTools frontend for plugin support
- **Express Middleware**: Provides custom Express middleware for plugin routing and serving
- **Configuration Options**: Flexible configuration for including/excluding specific plugins

## Installation

Install the Re.Pack plugin as a development dependency:

```bash
npm install --save-dev @rozenite/repack
```

## Quick Start

### Basic Setup

Add the Rozenite plugin to your Re.Pack configuration:

```javascript
// repack.config.mjs
import { withRozenite } from '@rozenite/repack';

export default withRozenite({
  // Your existing Re.Pack configuration
});
```

Or using the function style configuration:

```javascript
// repack.config.mjs
import { withRozenite } from '@rozenite/repack';

export default withRozenite((env) => ({
  // Your existing Re.Pack configuration
}));
```

### With Custom Options

Configure plugin discovery and filtering:

```javascript
// repack.config.mjs
import { withRozenite } from '@rozenite/repack';

export default withRozenite(
  {
    // Your existing Re.Pack configuration
  },
  {
    include: ['@my-org/my-plugin', 'another-plugin'],
    exclude: ['unwanted-plugin'],
    destroyOnDetachPlugins: ['@rozenite/network-activity-plugin'],
  }
);
```

## Configuration

### `RozeniteRepackConfig`

The configuration object for the Re.Pack plugin:

```typescript
type RozeniteRepackConfig = {
  enabled?: boolean; // Whether to enable Rozenite. The production guard is active either way.
  include?: string[]; // Only load these specific plugins
  exclude?: string[]; // Exclude these plugins from loading
  destroyOnDetachPlugins?: string[]; // Plugins that should be destroyed when switching panels
  allowInProduction?: string[]; // Plugin packages exempted from the production guard
};
```

**Options:**

- `enabled` - Whether Rozenite's dev server and plugin discovery are active. See
  [The production guarantee](#the-production-guarantee) below — `false` no longer disables the
  production guard itself (optional)
- `include` - Array of package names to explicitly include (optional)
- `exclude` - Array of package names to exclude from loading (optional)
- `destroyOnDetachPlugins` - Array of package names that should be destroyed when switching panels instead of maintaining their state (optional, by default all plugins persist their state)
- `allowInProduction` - Array of Rozenite plugin package names exempted from the production guard (optional, last resort — see [The production guarantee](#the-production-guarantee))

## The production guarantee

`withRozenite()` installs a guard, unconditionally, that keeps Rozenite plugin code out of production
bundles. It runs whether or not `enabled` is `true`. See the
[Production Guarantee](https://www.rozenite.dev/docs/production-guarantee) docs for the full picture;
the parts that affect this package specifically are below.

### The dev-entry redirect

`@rozenite/react-native`'s `<Rozenite />` component asks for a dev-entry module that, in a plain
resolution, would resolve to a shipped noop. When `enabled` is `true` and `env.mode` is
`'development'`, `withRozenite()` redirects that specific request to
`<projectRoot>/rozenite.dev`, letting Re.Pack's own `resolve.extensions` pick the right file. If no
matching file exists, resolution falls back to the shipped noop and logs once; a missing
`rozenite.dev` file is never a build failure.

### The build error

Independent of that redirect, every module Re.Pack resolves is checked against a simple rule: a
production build (`env.mode === 'production'`) must not resolve into a Rozenite plugin package except
through that plugin's declared `productionEntries`. A violation fails the build with a compilation
error naming the plugin and the importing file. In a development build the same violation only warns.

### `enabled: false` no longer means "do nothing"

**This is a behavior change.** Previously, `enabled: false` (or omitting `enabled`) short-circuited
`withRozenite()` entirely and returned your config untouched. Now, `enabled: false` still returns a
config without the dev server or plugin discovery, but the production guard above stays installed. If
you used `enabled: false` to keep a particular build free of Rozenite altogether, audit that build for
plugin imports living outside `rozenite.dev.tsx` — they'll now fail it.

### `allowInProduction`

An escape hatch for when you need to unblock a build immediately, before restructuring an import or
waiting on a plugin author to add a `productionEntries` declaration:

```javascript
// rspack.config.mjs
export default withRozenite(config, {
  allowInProduction: ['@acme/some-plugin'],
});
```

Every package listed here is exempted from the guard entirely, through any import path. This is
printed loudly once per build, since it defeats the production guarantee for the listed package(s) —
treat it as a last resort, not a fix.

## Plugin Discovery

The Re.Pack plugin automatically discovers Rozenite plugins by:

1. **Scanning node_modules**: Searches all node_modules directories in the project
2. **Checking for Rozenite manifest**: Looks for the Rozenite manifest file in each package
3. **Validating plugin structure**: Ensures the plugin has the required build output
4. **Loading plugin metadata**: Extracts plugin information for integration

## Development Workflow

1. **Install plugins** in your React Native project
2. **Configure Re.Pack** with the Rozenite plugin
3. **Start Re.Pack server** - plugins are automatically discovered and loaded
4. **Access DevTools** - plugins appear in the React Native DevTools interface
5. **Develop plugins** - use hot reload for plugin development

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

### Plugin not loading

- Check Re.Pack server logs for plugin discovery messages
- Verify plugin manifest file exists and is valid
- Ensure plugin assets are properly built and accessible

### Middleware conflicts

- The Rozenite middleware is designed to work alongside existing Re.Pack middleware
- Custom middleware is preserved and enhanced, not replaced
- Check for conflicts with other Re.Pack plugins

## Requirements

- Node.js >= 22
- Re.Pack bundler
- React Native project
- Installed Rozenite plugins

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/repack
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
