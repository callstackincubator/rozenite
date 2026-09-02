![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### Deprecated: `@rozenite/lynx-dev` has been merged into `@rozenite/lynx`.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

`@rozenite/lynx-dev` and `@rozenite/lynx` are now a single package. Install
[`@rozenite/lynx`](https://www.npmjs.com/package/@rozenite/lynx) and import
the plugin from `@rozenite/lynx/rspeedy` instead:

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

You no longer need to import `@rozenite/lynx` (or this package) anywhere in
your app's own source — `@rozenite/lynx/rspeedy` now injects the device
runtime for you, only in development. See
[`@rozenite/lynx`'s README](https://www.npmjs.com/package/@rozenite/lynx) for
the full option list and current documentation.

This package remains available, re-exporting `@rozenite/lynx/rspeedy`
unchanged, so existing `import { rozeniteLynxPlugin } from '@rozenite/lynx-dev'`
code keeps working. It will be removed in a future major version — please
migrate when convenient.

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
