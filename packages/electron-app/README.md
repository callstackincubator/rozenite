![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### The Electron shell that drives the Rozenite standalone app.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

`@rozenite/electron-app` opens `@rozenite/app` in a native Electron window.
It is the default way `rozenite open` launches the app: it points a
`BrowserWindow` at the same URL `rozenite open` already builds, and nothing
else. It has no native menus, does not discover Metro targets itself
(`rozenite open` does that), and is not yet packaged as an installable app
— it runs from source via `npx electron`.

## Usage

```bash
npx rozenite open
```

`rozenite open` picks a device, then opens this Electron shell for it. If
`@rozenite/electron-app` can't be resolved or spawned (for example, its
`electron` dependency failed to install), `rozenite open` falls back to
your default browser instead.

## Current limitations

- **Not packaged**: there is no installer or standalone binary yet. This
  package only runs from the monorepo/npm install, spawning the `electron`
  dependency directly.
- **No native chrome**: no custom menu bar, tray icon, or window
  persistence — just a bare `BrowserWindow` loading a URL.
- **Same connection model as the browser app**: it inherits every
  limitation of `@rozenite/app` (single debugger slot, requires Metro).

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/@rozenite/electron-app?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@rozenite/electron-app?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/electron-app
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
