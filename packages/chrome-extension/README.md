![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Chrome extension bridge enabling React Native DevTools for web applications powered by React Native.

[![mit licence][license-badge]][license] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite Chrome extension connects your browser to the React Native debugger server and relays Chrome DevTools Protocol (CDP) messages. It allows you to inspect and debug React Native Web apps from the familiar DevTools interface.

## Features

- **DevTools Bridge**: Connects browser tabs to the React Native debugger server via WebSocket
- **Chrome DevTools Protocol**: Full CDP relay for debugging, profiling, and inspection
- **Automatic Page Detection**: Discovers Rozenite-enabled localhost tabs and manages connections
- **Manifest V3**: Modern Chrome extension architecture with service worker

## Development

Build the extension in watch mode:

```bash
pnpm dev
```

Load the `dist` folder in Chrome at `chrome://extensions` (Developer mode enabled).

## Build

Produce a production build:

```bash
pnpm build
```

Output is written to `dist/`.

## Test

Run unit tests:

```bash
pnpm test
```

Uses Node.js built-in test runner.

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
