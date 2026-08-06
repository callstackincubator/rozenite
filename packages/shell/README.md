![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A unified shell for Rozenite panels in React Native DevTools.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite Shell provides the shared DevTools panel experience for Rozenite
plugins. It renders the plugin sidebar, panel selection, embedded plugin
iframes, welcome dialog, and release notifications in one consistent layout.

The shell is served by `@rozenite/middleware` and is normally configured for
you by the Rozenite Metro or Re.pack integrations. You typically do not need
to import or render it directly.

## Features

- **Unified Panel Navigation**: Browse all installed plugin panels from one
  sidebar.
- **Embedded Plugin Panels**: Render plugin DevTools panels while forwarding
  messages between the shell and each panel.
- **Responsive Layout**: Resize or collapse the sidebar to make room for panel
  content.
- **Release Messaging**: Show welcome and new-version information inside the
  DevTools experience.

## Installation

The shell is installed automatically as a dependency of the Rozenite bundler
integrations. For custom bundler integrations, install it alongside the
middleware package:

```bash
npm install @rozenite/middleware @rozenite/shell
```

## Usage

Use the Rozenite Metro or Re.pack integration to serve the shell automatically.
If you are building a custom integration, `@rozenite/middleware` serves the
compiled shell assets and wires its configuration to the React Native DevTools
frontend.

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/@rozenite/shell?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@rozenite/shell?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/shell
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
