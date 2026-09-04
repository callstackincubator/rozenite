![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### Rozenite for React Native

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

**`@rozenite/react-native`** is the app-side seam for Rozenite. It is the only Rozenite package that
ships to a production bundle, so it is deliberately trivial: it renders a noop and imports nothing
besides `react`.

## Why this exists

Wiring every plugin by hand into your app entry point, then remembering to guard each import so it
never reaches production, is error-prone. This package removes the guesswork: render `<Rozenite />`
unconditionally, and let `withRozenite()` (from `@rozenite/metro` or `@rozenite/repack`) decide what it
resolves to.

- In **development**, `withRozenite()` redirects `<Rozenite />` to your project's `rozenite.dev` file,
  where all of your plugin wiring lives.
- In **production**, `<Rozenite />` resolves to a shipped noop. No plugin code is ever included.

## Install

```bash
pnpm add @rozenite/react-native
```

## Usage

Render `<Rozenite />` once, near the root of your app, with nothing to guard:

```tsx
import Rozenite from '@rozenite/react-native';

export default function App() {
  return (
    <>
      <Rozenite />
      {/* your app */}
    </>
  );
}
```

Then create a `rozenite.dev.tsx` file next to your Metro or Re.Pack config, and wire up your plugins
there — it's an ordinary project file, so Fast Refresh works on it, and it may span as many files as you
want:

```tsx
// rozenite.dev.tsx
import { useRozeniteStoragePlugin, createMMKVStorageAdapter } from '@rozenite/storage-plugin';
import { storage } from './src/storage';

export default function RozeniteDevTools() {
  useRozeniteStoragePlugin({ adapters: [createMMKVStorageAdapter({ mmkv: storage })] });
  return null;
}
```

In production, `<Rozenite />` renders nothing and pulls in no plugin code — there is nothing to remove
before shipping.

## Documentation

The documentation is available at [rozenite.dev](https://rozenite.dev). You can also use the following
links to jump to specific topics:

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
[npm-downloads-badge]: https://img.shields.io/npm/dm/@rozenite/react-native?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/react-native
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: ./CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
