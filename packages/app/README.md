![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A standalone Rozenite DevTools application that runs in its own browser window.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

`@rozenite/app` is the Rozenite shell, connected directly to a device over
its own CDP WebSocket and served on its own page instead of embedded in the
React Native DevTools frontend. It is launched with `rozenite open`, is
served by `@rozenite/middleware`, and is currently **opt-in** — it does not
replace the embedded DevTools panel experience.

Running as its own page rather than inside DevTools means the shell survives
things that would otherwise reset it. Its headline capability is that
**installed plugin panels stay mounted across a JS-VM reload**: today, the
embedded panel tears every panel down on each app reload. This app instead
shows a "Reloading…" status in its footer, reconnects to the device once the
new JS VM comes up, and leaves your panels' state untouched.

## Features

- **Panels survive reloads**: A JS-VM reload reconnects the underlying
  device connection without unmounting the shell or its panels.
- **Own browser window**: Runs outside the React Native DevTools frontend,
  so it isn't tied to that window's lifecycle.
- **Status footer**: Shows connection state — connecting, connected,
  reloading, disconnected, Rozenite not installed, or dev server
  unreachable — with a way to retry or reconnect from each problem state.

## Installation

`@rozenite/app` is not installed directly. It ships as a dependency of
`@rozenite/middleware`, which serves its build automatically, and is opened
with the `rozenite` CLI's `open` command.

## Usage

Start your dev server (`rozenite open` needs a running one to talk to),
then run:

```bash
npx rozenite open
```

This looks at the default port of every supported integration — Metro's
`8081` and the Lynx dev server's `3000` — lists the devices connected to
whichever is running, labelled by integration, and opens this app,
in an Electron window (via `@rozenite/electron-app`) for the one you
pick, or your default browser if Electron isn't available.

## Current limitations

- **Single debugger slot**: The app connects directly to the device, the
  same way React Native DevTools and `rozenite agent` do. Only one
  connection can be attached to a device at a time, so opening this app
  disconnects React Native DevTools (or `rozenite agent`) if either is
  already attached, and vice versa — whichever connects last wins.
- **Requires Metro**: The app is served by Metro, so it isn't reachable
  unless Metro is running. If Metro stops, the app shows a "dev server
  unreachable" state until it's back.
- **Interactive only**: `rozenite open` requires a terminal a person can
  respond to and cannot be used in CI or non-interactive shells.

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/@rozenite/app?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@rozenite/app?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/app
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
