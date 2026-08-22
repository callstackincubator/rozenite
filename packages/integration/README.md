![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### The host integration abstraction shared by every Rozenite bundler plugin.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

`@rozenite/middleware` serves two very different hosts - React Native (via `@rozenite/metro` / `@rozenite/repack`) and Lynx (via `@rozenite/lynx-dev`) - behind one dev server. `@rozenite/integration` is where what differs between them lives: verifying the environment, resolving and serving a debugger frontend, and patching a bundler's dev middleware for the `Rozenite.getEnvironment` CDP domain. The middleware itself no longer asks "is this Lynx?" anywhere; it asks its configured `RozeniteIntegration` instead.

This package is used internally by `@rozenite/middleware` and `@rozenite/lynx-dev`. You won't need to install or configure it directly unless you're developing a new bundler or host integration for Rozenite.

## Features

- **One Contract, Two Hosts**: `RozeniteIntegration` describes exactly what a host integration does differently - preflighting the environment, locating a debugger frontend (or none), and installing inspector hooks
- **React Native Implementation**: `createReactNativeIntegration` verifies the installed React Native version, resolves the Fusebox debugger frontend, and patches `@react-native/dev-middleware` so it reports the right integration over CDP
- **Lynx Has No Frontend To Serve**: a host integration without a debugger frontend returns `null` from `getDebuggerFrontendPath`, so the caller can serve `@rozenite/app` standalone instead

## Installation

Install the package as a dependency:

```bash
npm install @rozenite/integration
```

## Exports

This package exports:

- `RozeniteIntegration`
- `createReactNativeIntegration`
- `CreateReactNativeIntegrationOptions`

## Usage

```typescript
import { createReactNativeIntegration, type RozeniteIntegration } from '@rozenite/integration';

const integration: RozeniteIntegration = createReactNativeIntegration({
  projectRoot: process.cwd(),
});

integration.verifyEnvironment();
integration.installInspectorHooks();

const debuggerFrontendPath = integration.getDebuggerFrontendPath();
```

A host with no debugger frontend of its own - like Lynx - implements the same contract with `getDebuggerFrontendPath` returning `null`, and `verifyEnvironment` / `installInspectorHooks` as no-ops:

```typescript
const lynxIntegration: RozeniteIntegration = {
  id: 'lynx',
  verifyEnvironment: () => {},
  getDebuggerFrontendPath: () => null,
  installInspectorHooks: () => {},
};
```

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/@rozenite/integration?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@rozenite/integration?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/integration
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
