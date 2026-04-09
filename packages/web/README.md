![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### Rozenite for Web

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

**Rozenite for Web** lets you debug React Native web apps with Rozenite and React Native DevTools.

To use it, you need:

- the Rozenite browser extension installed in a Chromium-based browser
- the `@rozenite/web` package added to your app

## Install

```bash
pnpm add -D @rozenite/web
```

Install the browser extension from the [GitHub releases](https://github.com/callstackincubator/rozenite/releases).

## Setup

- Use `@rozenite/web/metro` and wrap your Metro config with `withRozeniteWeb(config)` when Metro also bundles the web app.
- Use `@rozenite/web/webpack` when Webpack Dev Server bundles and serves the web app.
- For Metro-only web, also add `require('@rozenite/web')` to your web entry point.

## Documentation

The documentation is available at [rozenite.dev](https://rozenite.dev). You can also use the following links to jump to specific topics:

- [Rozenite for Web](https://rozenite.dev/docs/rozenite-for-web)
- [Quick Start](https://rozenite.dev/docs/getting-started)
- [Plugin Directory](https://rozenite.dev/plugin-directory)
- [Plugin Development](https://rozenite.dev/docs/plugin-development/overview)

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@rozenite/web?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/web
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: ./CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
