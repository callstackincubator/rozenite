# @rozenite/ui

Shared UI foundation for Rozenite DevTools plugin panels: design tokens, a
`Split` resizable layout primitive, and `PluginShell` / `PluginHeader`
layout components with built-in light/dark theming.

This package is consumed by Rozenite plugin panels (the React app rendered
inside a plugin's DevTools tab). It ships zero consumers today — it is the
foundation other plugin panels will build on.

## Usage

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
