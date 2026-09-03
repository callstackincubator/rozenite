# @rozenite/ui

## 2.4.0

## 2.3.0

### Minor Changes

- [#453](https://github.com/callstackincubator/rozenite/pull/453) [`05939d7`](https://github.com/callstackincubator/rozenite/commit/05939d7b1737a2a9ab483c2df786fa84680c8945) Thanks [@V3RON](https://github.com/V3RON)! - Rebuild the Require Profiler DevTools panel on `@rozenite/ui`, so it follows the shared theme and the light/dark switch like every other panel. A sidebar lists every recorded require chain with its duration and module count and can hide chains below a duration threshold, replacing the previous prev/next stepper and options modal — and because durations now travel with the chain list, the threshold applies to chains that have not been opened yet. The main pane switches between the flame graph and a "Top modules" table ranking the chain's modules by self time, a filter box highlights matching frames and narrows the table, and selecting a module opens a detail pane with its self time, total time, dependency count, and path. Require timings are now recorded with `performance.now()` where the runtime provides it, so fast modules no longer all report 0ms.

  The Metro instrumentation now defends its own dev-only boundary, underneath `withRozenite`'s `enabled` gate rather than relying on it alone. `withRozeniteRequireProfiler` accepts an `enabled` option that defaults to `process.env.NODE_ENV !== 'production'`, and the polyfill it injects is guarded by `__DEV__` so Metro strips it from release bundles — covering configs that enable Rozenite unconditionally and setups that apply the wrapper without `withRozenite`.

  `@rozenite/ui` gains a `FlameGraph` component — a themed, responsive flame graph with animated zooming, selection, search highlighting, and a heat legend.

- [#446](https://github.com/callstackincubator/rozenite/pull/446) [`40a8ccd`](https://github.com/callstackincubator/rozenite/commit/40a8ccd5a186912ea3dd69564e7efd2c016f611c) Thanks [@V3RON](https://github.com/V3RON)! - Add `RozeniteLoader` — a dithered gem loading spinner masked to the Rozenite
  logo silhouette, for on-brand loading states in DevTools plugin panels.

- [#442](https://github.com/callstackincubator/rozenite/pull/442) [`f788719`](https://github.com/callstackincubator/rozenite/commit/f7887194dd15ff6e165f46d215677899c4e4a1ee) Thanks [@V3RON](https://github.com/V3RON)! - Add three primitives for building log and stream panels.

  `ToggleGroup` is a segmented control for filters where more than one option
  can be active at once — log levels, tags, sources. It reads as a sibling of
  `Tabs`, and supports single or multiple selection, icon-only items, and the
  three control sizes.

  `VirtualizedList` is the non-tabular counterpart to `VirtualizedDataTable`,
  for large streams of freely-composed rows that vary in height. Rows need no
  measurement or fixed height, and `followOutput` pins the view to the newest
  row while entries stream in, releasing as soon as the reader scrolls away —
  the affordance a live log tail needs.

  `QueryField` is a query input that highlights the parts of a query as the
  reader types. It owns no grammar and no operator vocabulary: the caller
  tokenizes its own query language and hands over ranges, and `QueryField`
  paints them, so a panel can bring any query syntax. Malformed fragments can
  be marked so a typo is visible before the query is run.

### Patch Changes

- [#451](https://github.com/callstackincubator/rozenite/pull/451) [`b758637`](https://github.com/callstackincubator/rozenite/commit/b758637fd6af638d9b214849d390163ce4efda19) Thanks [@V3RON](https://github.com/V3RON)! - Speed up `RozeniteLoader`'s animation: the default `period` drops from 3600ms
  to 2000ms per loop, so it reads as active rather than sluggish. Pass `period`
  explicitly to keep the old pace.

## 2.2.0

### Minor Changes

- [#425](https://github.com/callstackincubator/rozenite/pull/425) [`8b373d9`](https://github.com/callstackincubator/rozenite/commit/8b373d929f7bb64438bc63e516e8ad31966f61ba) Thanks [@V3RON](https://github.com/V3RON)! - Add `useConfirmDialog()` to `@rozenite/ui`: an imperative alternative to `ConfirmDialog` that resolves a promise with the user's choice instead of driving `open` from local state. `PluginShell` now mounts `Toast` and `ConfirmDialog.Provider` automatically, so plugin panels no longer need to wrap themselves in `<Toast.Provider>` to use `useToast()`.

  Migrate the feature-flags, storage, and React Hook Form DevTools panels to `useConfirmDialog()`, replacing their declarative confirm/alert dialogs.

- [#419](https://github.com/callstackincubator/rozenite/pull/419) [`850e455`](https://github.com/callstackincubator/rozenite/commit/850e45576c41d52e24d6c239ff2947a612406fae) Thanks [@V3RON](https://github.com/V3RON)! - Add tone tokens for `success`, `warning`, and `info`, plus a `--danger` alias for the existing `--destructive` pair. Export the `Tone` and `Size` unions and the `surfaceTone`/`textTone` cva recipes so components can compose consistent tone-aware styling. No existing component's behavior changes.

- [#420](https://github.com/callstackincubator/rozenite/pull/420) [`0565227`](https://github.com/callstackincubator/rozenite/commit/0565227761c0f52df0f7fbf30d0ac5833ccc4039) Thanks [@V3RON](https://github.com/V3RON)! - Add seven new `@rozenite/ui` primitives: `Text`/`Heading` for typography, `Row`/`Column` for flex layout (including the `fill`+`scroll` idiom for scrollable panes), `Icon` for rendering any icon component at a shared size scale plus a curated lucide re-export, `IconButton` for a labelled, tooltip-carrying icon-only button, `Menu` for dropdown actions, `Alert` for tone-aware inline status strips, and `Kbd` for keyboard shortcut hints. All additive — no existing component's behavior changes.

- [#421](https://github.com/callstackincubator/rozenite/pull/421) [`15f31f0`](https://github.com/callstackincubator/rozenite/commit/15f31f0091c0bf3bbf48a192925f57c20efd8951) Thanks [@V3RON](https://github.com/V3RON)! - Add `render` polymorphism (via Base UI's `useRender`) to `Button`, `Badge`, `Link`, `List.Item`, `Card`, `EmptyState`, `PluginHeader.*`, and the Phase 1 primitives (`Text`, `Heading`, `Row`, `Column`, `IconButton`, `Alert`, `Kbd`), so they can render as anything (an anchor, a router link, a custom element) instead of only their default tag.

  Make `Toast` itself callable, matching every other namespace in the package — `Toast.Provider` remains as a deprecated alias. Give `Sidebar.Group`/`Sidebar.Item` their own `data-slot`s instead of aliasing `List.Group`/`List.Item`. Add label override props (`closeLabel`, `clearLabel`, `dismissLabel`, `collapseLabel`/`expandLabel`, `lightLabel`/`darkLabel`) to `Dialog.Content`, `SearchField`, `Toast`, `Card`, and `PluginHeader.ThemeSwitcher` for localization.

  Fix a real bug in `VirtualizedDataTable`: its `className`/`scrollClassName` props previously replaced the component's base styling instead of extending it. Align its accessibility and empty-state copy with `DataTable`, and move it into a name-matched folder.

- [#423](https://github.com/callstackincubator/rozenite/pull/423) [`9f7581e`](https://github.com/callstackincubator/rozenite/commit/9f7581e8a1e4d506a93c30876231fbe21147c0de) Thanks [@V3RON](https://github.com/V3RON)! - Unify the size scale, split tone from emphasis, and remove layout-leakage margins across `@rozenite/ui` components. `@rozenite/ui` is mainly consumed internally by Rozenite's own plugin panels, so the blast radius of these changes is small; released as `minor` rather than `major` on that basis. All `@rozenite/*` packages bump together.

  **Migration table:**

  | Before                                                               | After                                                                                                                                             |
  | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `Button`'s `adornment` prop                                          | `trailing`                                                                                                                                        |
  | `List.Item`/`NestedList.Item`/`Sidebar.Item`'s `adornment` prop      | `leading`                                                                                                                                         |
  | `Button` `size="default"`                                            | `size="md"`                                                                                                                                       |
  | `Button` `size="compact"`                                            | `size="sm"`                                                                                                                                       |
  | `Button` `size="icon"`                                               | Use `IconButton` instead                                                                                                                          |
  | `Button`/`Badge`/`IconButton` `variant="secondary"`                  | `tone="neutral"`                                                                                                                                  |
  | `Button`/`Badge`/`IconButton` `variant="outline"` / `"ghost"`        | add `tone="neutral"` alongside                                                                                                                    |
  | `Button`/`Badge`/`IconButton` `variant="destructive"`                | `tone="danger"` (drop `variant`)                                                                                                                  |
  | `IndicatorDot` `variant="default"` / `"destructive"`                 | `tone="primary"` / `tone="danger"`                                                                                                                |
  | `ConfirmDialog`'s `destructive` boolean                              | `tone="danger"`                                                                                                                                   |
  | `--destructive` / `--destructive-foreground` CSS vars                | `--danger` / `--danger-foreground`                                                                                                                |
  | `text-destructive` / `bg-destructive` / `border-destructive` classes | `text-danger` / `bg-danger` / `border-danger`                                                                                                     |
  | `PluginHeader.Actions` relying on its own `ml-auto`                  | `PluginHeader` root now uses `justify-between` — group leading content (e.g. `Title` + `Subtitle`) in one wrapper so actions still sit at the end |
  | `Sidebar` default width (`w-56`)                                     | pass `className="w-56"` (or any width) explicitly                                                                                                 |
  | `Sidebar.Footer`'s own `mt-auto`                                     | removed — pin it to the bottom via a `flex-1` scrollable middle section (see `Sidebar` stories), or pass `className="mt-auto"` explicitly         |
  | `Toolbar.Separator`'s own `mx-1`                                     | removed — spacing now comes from `Toolbar`'s `gap-1`                                                                                              |

  **New capability:** `Toast` gains a `viewportClassName` prop to reposition the notification viewport (previously hardcoded to `fixed right-4 bottom-4`).

  **Also fixed:** `Input`, `Textarea`, `Select.Trigger`, `Combobox.Input`, `SearchField`, `Field.Control`, `Toolbar.Button`, `Tabs.List`, `Tabs.Tab`, `List.Item`, `NestedList.Item`, `Sidebar.Item`, and `Badge` now share one `sm | md | lg` size scale, replacing inconsistent hardcoded heights (previously `h-8`/`h-7`/`h-6` mismatches across otherwise-equivalent controls). `List.Item`/`NestedList.Item`/`Sidebar.Item` default to `md` (`h-8`), matching their previous `h-7` more closely than `sm` would. `Toolbar.Button` defaults to `sm` (`h-6`/`text-xs`), down from its previous `h-7`/`text-sm` — square icon-only toolbar buttons should size to `size-6`. `PluginHeader.ThemeSwitcher` shrank from `h-7 w-7` to `h-6 w-6` to match. `Badge` gains the full `Tone` scale (previously had no `danger` tone at all), and its own `sm` size now scales the trigger's icon/padding, not just height. `EmptyState`'s internal spacing is now a uniform `gap-3` between icon/title/description/action, replacing bespoke per-child margins.

  `surfaceTone` (the shared recipe behind `Button`/`Badge`/`IconButton`) only adds hover states when a caller opts in with `interactive: true` — `Button`/`IconButton` do; `Badge`/`Alert` don't, since neither is clickable.

  **Breaking for direct consumers of the exported recipes:** `buttonVariants()` and `badgeVariants()` no longer include color — they cover shape/size only. Color comes from `surfaceTone()`, composed alongside them. A bare `buttonVariants()` call now yields a colorless button.

  **Also additive:** `Button` gains a `size="lg"` step; `IndicatorDot` gains a `size` prop (`sm | md | lg`); `ConfirmDialog` now accepts `className`.

### Patch Changes

- [#417](https://github.com/callstackincubator/rozenite/pull/417) [`db0a792`](https://github.com/callstackincubator/rozenite/commit/db0a79283562dfd889e8e0f478b384ba21cfe5bf) Thanks [@V3RON](https://github.com/V3RON)! - Fix `ScrollArea`'s corner (where the vertical and horizontal scrollbars meet) rendering as an unstyled white square instead of matching the surrounding background. Also style the native `::-webkit-scrollbar-corner` for scrollable elements that don't use `ScrollArea`.

- [#409](https://github.com/callstackincubator/rozenite/pull/409) [`b409250`](https://github.com/callstackincubator/rozenite/commit/b409250480260b793c504d536755a5ba933de4fe) Thanks [@V3RON](https://github.com/V3RON)! - Fix `Toolbar.Button` not visually dimming or disabling hover/pointer interaction when `disabled`. The component only ever set `aria-disabled` (not the native `disabled` attribute or `data-disabled`), so its styles were targeting a selector that never matched.

## 2.1.0

### Minor Changes

- [#378](https://github.com/callstackincubator/rozenite/pull/378) [`3ec6730`](https://github.com/callstackincubator/rozenite/commit/3ec673095da118cd0ac52c33cae0d8b03b0e162a) Thanks [@V3RON](https://github.com/V3RON)! - Add `List` and `NestedList` components — a shared, extensible list primitive with grouped, selectable items and an adornment slot for leading icons, plus a collapsible tree variant that nests to an arbitrary depth with automatic left indentation. `Sidebar` now shares its item/group rendering with `List`, and its items support the new `adornment` prop.

- [#381](https://github.com/callstackincubator/rozenite/pull/381) [`629df05`](https://github.com/callstackincubator/rozenite/commit/629df051e4ef08775a9a4e1a008aba819d7be05d) Thanks [@V3RON](https://github.com/V3RON)! - Add a Plugins screen to shell mode, opened from a new cog button in the sidebar footer. It lists every loaded plugin with its package id, description, installed version, panels, and a link to npm when a newer version is published. The cog shows a dot when any plugin or the runtime itself has an update available. Panel state is preserved while the screen is open. Also fixes the npm version check to use the CDN-cached registry endpoint instead of the rate-limited `/latest` endpoint, and to correctly ignore local builds ahead of npm.

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
