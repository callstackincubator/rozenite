![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A cornerstone of the bundler integration shared between Metro and Re.pack for React Native DevTools plugins.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite middleware package provides the core infrastructure for integrating custom DevTools plugins into React Native development environments. It serves as the foundation for bundler integration, automatically discovering installed plugins, serving them through development servers, and providing the necessary infrastructure for plugin communication and UI rendering.

This package is primarily used internally by Metro and Re.pack integrations. You won't need to install or configure this package directly unless you're developing a new bundler integration for Rozenite.

## Features

- **Automatic Plugin Discovery**: Automatically finds and loads installed Rozenite plugins from node_modules
- **Bundler Integration**: Provides the core middleware infrastructure for bundler plugins
- **Plugin Serving**: Serves plugin assets and panels through development servers
- **DevTools Frontend Integration**: Patches React Native DevTools frontend for plugin support
- **Express Middleware**: Provides custom Express middleware for plugin routing and serving
- **Configuration Options**: Flexible configuration for including/excluding specific plugins

## Plugin Discovery

The middleware automatically discovers Rozenite plugins by:

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

## Development Workflow

1. **Install plugins** in your React Native project
2. **Use Metro or Re.pack** - the middleware is automatically integrated
3. **Start development server** - plugins are automatically discovered and loaded
4. **Access DevTools** - plugins appear in the React Native DevTools interface
5. **Develop plugins** - use hot reload for plugin development

## Troubleshooting

### No plugins found

- Ensure plugins are properly installed in `node_modules`
- Check that plugins have been built and contain `dist/rozenite.json`
- Verify plugin package names are not excluded in configuration

### Plugin not loading

- Check development server logs for plugin discovery messages
- Verify plugin manifest file exists and is valid
- Ensure plugin assets are properly built and accessible

## Requirements

- Node.js >= 22
- Metro bundler or Re.pack
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
[npm-downloads]: https://www.npmjs.com/package/@rozenite/metro
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
