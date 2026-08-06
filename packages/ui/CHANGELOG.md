# @rozenite/ui

## 2.0.0

### Minor Changes

- [#365](https://github.com/callstackincubator/rozenite/pull/365) [`81bddb8`](https://github.com/callstackincubator/rozenite/commit/81bddb87ab29e45804172a4be7595880099384d9) Thanks [@V3RON](https://github.com/V3RON)! - Rebuild the Rozenite Dev Host on shared UI primitives and add a storage-plugin
  initialization flow for exercising storage message interactions during plugin development.

- [#347](https://github.com/callstackincubator/rozenite/pull/347) [`88c1faf`](https://github.com/callstackincubator/rozenite/commit/88c1faffb6ffdeaaf05bad750cfb8e46470f3ff5) Thanks [@V3RON](https://github.com/V3RON)! - Add new `@rozenite/ui` package: shared design tokens, a `Split` resizable
  layout primitive, and `PluginShell` / `PluginHeader` layout components with
  built-in light/dark theming for building DevTools plugin panels.

- [#352](https://github.com/callstackincubator/rozenite/pull/352) [`6fad9f3`](https://github.com/callstackincubator/rozenite/commit/6fad9f3a3ac8a5c350d2e8b8c8336642aac5f73d) Thanks [@V3RON](https://github.com/V3RON)! - Add `@rozenite/ui` core control and data-display primitives: `Select`,
  `Combobox`, `Dialog`, `Tooltip`, `Tabs`, `ScrollArea`, `Field`, `Toolbar`,
  and `Toast` built on Base UI, plus `Button`, `Badge`, `Input`, `SearchField`,
  `DataTable` (sortable, editable, with row actions), `Sidebar`, `EmptyState`,
  `ConfirmDialog`, `JsonInspector`, and a `useCopyToClipboard` hook for
  building DevTools plugin panels.

- [#362](https://github.com/callstackincubator/rozenite/pull/362) [`222945f`](https://github.com/callstackincubator/rozenite/commit/222945f00049ca8b7a3746478d6a94b7e4ced6a7) Thanks [@V3RON](https://github.com/V3RON)! - Unify Controls, Overlay, and React Navigation DevTools panels with shared UI
  primitives, sidebar layouts, and dark-theme form controls.

### Patch Changes

- [#341](https://github.com/callstackincubator/rozenite/pull/341) [`de396d6`](https://github.com/callstackincubator/rozenite/commit/de396d651d592ac4186f3971d26c8f0551358d64) Thanks [@V3RON](https://github.com/V3RON)! - Keep dialog contents visible and unchanged throughout close transitions.

- [#361](https://github.com/callstackincubator/rozenite/pull/361) [`b42bf95`](https://github.com/callstackincubator/rozenite/commit/b42bf95cd1573e84ce2faefae92c021575709a33) Thanks [@V3RON](https://github.com/V3RON)! - Align the shared DevTools UI theme and Storage panel with the Rozenite website.
