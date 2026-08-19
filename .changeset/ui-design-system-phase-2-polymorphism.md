---
'@rozenite/ui': minor
---

Add `render` polymorphism (via Base UI's `useRender`) to `Button`, `Badge`, `Link`, `List.Item`, `Card`, `EmptyState`, `PluginHeader.*`, and the Phase 1 primitives (`Text`, `Heading`, `Row`, `Column`, `IconButton`, `Alert`, `Kbd`), so they can render as anything (an anchor, a router link, a custom element) instead of only their default tag.

Make `Toast` itself callable, matching every other namespace in the package — `Toast.Provider` remains as a deprecated alias. Give `Sidebar.Group`/`Sidebar.Item` their own `data-slot`s instead of aliasing `List.Group`/`List.Item`. Add label override props (`closeLabel`, `clearLabel`, `dismissLabel`, `collapseLabel`/`expandLabel`, `lightLabel`/`darkLabel`) to `Dialog.Content`, `SearchField`, `Toast`, `Card`, and `PluginHeader.ThemeSwitcher` for localization.

Fix a real bug in `VirtualizedDataTable`: its `className`/`scrollClassName` props previously replaced the component's base styling instead of extending it. Align its accessibility and empty-state copy with `DataTable`, and move it into a name-matched folder.
