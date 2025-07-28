![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A runtime framework for orchestrating React Native DevTools plugins in the browser environment.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite Runtime is the core framework that orchestrates React Native DevTools plugins in the browser environment. It handles plugin discovery, loading, panel creation, and integration with the React Native DevTools frontend. The runtime provides the foundation for seamless plugin execution and communication.

## Features

- **Plugin Orchestration**: Manages the lifecycle of multiple DevTools plugins
- **Panel Integration**: Seamlessly integrates plugin panels into React Native DevTools
- **Automatic Discovery**: Discovers and loads installed plugins from the global namespace
- **Development Mode**: Hot-reload support for plugin development
- **Error Handling**: Robust error handling and recovery mechanisms
- **Manifest Loading**: Dynamic loading of plugin manifests and configurations
- **Iframe Management**: Secure iframe-based plugin isolation
- **Message Routing**: Handles communication between plugins and DevTools

## Installation

The runtime is automatically included with the Rozenite Metro plugin and doesn't require separate installation. It's loaded as part of the DevTools frontend integration.

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/runtime
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
