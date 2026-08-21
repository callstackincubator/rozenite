![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### Rozenite's device-side runtime for Lynx.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

`@rozenite/lynx` is the small runtime a [Lynx](https://lynxjs.org) app imports once at its entry point. Importing it installs the global that [`@rozenite/plugin-bridge`](https://www.npmjs.com/package/@rozenite/plugin-bridge) talks to on the device, so Rozenite DevTools plugins can exchange messages with the host over Lynx's own devtool channel.

## Features

- **Zero configuration**: a single import at the app's entry point is all that's needed
- **Zero runtime dependencies**: nothing beyond `tslib`
- **Background-runtime aware**: only installs where `lynx.getDevtool()` actually exists, so it's inert (and side-effect free) everywhere else

## Installation

```bash
npm install @rozenite/lynx
```

## Usage

Import `@rozenite/lynx` once, as early as possible in your app's entry point, guarded for development builds. It must run before any plugin's `useRozeniteDevToolsClient` runs, so plugin device code always finds the dispatcher already installed.

```ts
if (__DEV__) {
  require('@rozenite/lynx');
}
```

If your entry point already uses ES module imports guarded by a dev check, a static import works the same way as long as it executes before your plugins do:

```ts
import '@rozenite/lynx';
```

That's it — no further setup is required. Rozenite DevTools plugins used in your app will now be able to connect to the host.

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
