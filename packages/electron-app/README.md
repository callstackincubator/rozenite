![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### The Electron shell that drives the Rozenite standalone app.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

`@rozenite/electron-app` opens `@rozenite/app` in a native Electron window.
It is the only way `rozenite open` launches the app: it points a
`BrowserWindow` at the same URL `rozenite open` already builds. It does not
discover Metro targets itself (`rozenite open` does that), and is not yet
packaged as an installable app — it runs from source via `npx electron`.

## Usage

```bash
npx rozenite open
```

`rozenite open` picks a device, then opens this Electron shell for it.

One process owns every window. Running `rozenite open` again for a device
that already has a window focuses that window instead of opening a second
one against the same debugger — so a running window keeps its panel state
— while a different device gets a sibling window in the same process.

External links (documentation, npm) open in your browser, and the window
has no reload command: panels surviving a JS-VM reload is the point of the
standalone app, and reloading the window would discard exactly that state.

On macOS the window runs from a renamed copy of Electron's own app bundle,
cached under `~/Library/Caches/rozenite/electron-<version>/`. macOS reads an
app's name from its bundle before any JavaScript runs, so this is the only
way the Dock, Cmd+Tab switcher, menu bar, and Activity Monitor say
"Rozenite" rather than "Electron" while the app is still unpackaged. The
copy is an APFS clone — it takes about 0.1s to make and no extra disk space
— and if anything about it fails, the launcher silently falls back to
Electron's own binary.

## Current limitations

- **Not packaged**: there is no installer or standalone binary yet. This
  package only runs from the monorepo/npm install, spawning the `electron`
  dependency directly.
- **"Electron" still shows on Windows/Linux and for helper processes**: the
  bundle rename above is macOS-only, and Electron's helper processes keep
  their own names in Activity Monitor. Packaging the app is what fixes both.
- **No window persistence**: size and position are not remembered between
  launches; every window opens at the same default size.
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
