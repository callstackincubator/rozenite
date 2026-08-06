![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### Shared UI foundation for Rozenite DevTools plugin panels.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite UI package provides reusable components, design tokens, and
layout primitives for plugin panels rendered inside React Native DevTools. It
includes built-in light and dark theming, as well as the `PluginShell`,
`PluginHeader`, and `Split` components used by Rozenite's own panels.

## Features

- **Panel Layout**: Build consistent plugin panels with `PluginShell` and
  `PluginHeader`.
- **Resizable Layouts**: Arrange panel content with the `Split` primitive.
- **Reusable Components**: Use accessible controls, data displays, dialogs,
  navigation, and feedback components.
- **Theming**: Support light and dark themes with shared design tokens.

## Installation

Install the UI package as a dependency:

```bash
npm install @rozenite/ui
```

## Quick Start

Import the stylesheet once, then use the components:

```css
@import '@rozenite/ui/styles.css';
```

```tsx
import { PluginShell, PluginHeader, Split } from '@rozenite/ui';

function Panel() {
  return (
    <PluginShell>
      <PluginHeader>
        <PluginHeader.Title>My Plugin</PluginHeader.Title>
        <PluginHeader.Actions>
          <PluginHeader.ThemeSwitcher />
        </PluginHeader.Actions>
      </PluginHeader>
      <PluginShell.Body>
        <Split direction="horizontal">
          <Split.Pane defaultSize={25} minSize={15} collapsible>
            Sidebar
          </Split.Pane>
          <Split.Handle />
          <Split.Pane>Content</Split.Pane>
        </Split>
      </PluginShell.Body>
    </PluginShell>
  );
}
```

Panels that bring their own styling (styled-components, a third-party
widget) can render `<PluginShell unstyled>` to get the layout scaffolding
without the theme provider or design tokens.

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/@rozenite/ui?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@rozenite/ui?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/ui
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
