---
'@rozenite/ui': major
---

Unify the size scale, split tone from emphasis, and remove layout-leakage margins across `@rozenite/ui` components. All `@rozenite/*` packages bump together since this is a breaking release.

**Migration table:**

| Before | After |
|---|---|
| `Button`'s `adornment` prop | `trailing` |
| `List.Item`/`NestedList.Item`/`Sidebar.Item`'s `adornment` prop | `leading` |
| `Button` `size="default"` | `size="md"` |
| `Button` `size="compact"` | `size="sm"` |
| `Button` `size="icon"` | Use `IconButton` instead |
| `Button`/`Badge`/`IconButton` `variant="secondary"` | `tone="neutral"` |
| `Button`/`Badge`/`IconButton` `variant="outline"` / `"ghost"` | add `tone="neutral"` alongside |
| `Button`/`Badge`/`IconButton` `variant="destructive"` | `tone="danger"` (drop `variant`) |
| `IndicatorDot` `variant="default"` / `"destructive"` | `tone="primary"` / `tone="danger"` |
| `ConfirmDialog`'s `destructive` boolean | `tone="danger"` |
| `--destructive` / `--destructive-foreground` CSS vars | `--danger` / `--danger-foreground` |
| `text-destructive` / `bg-destructive` / `border-destructive` classes | `text-danger` / `bg-danger` / `border-danger` |
| `PluginHeader.Actions` relying on its own `ml-auto` | `PluginHeader` root now uses `justify-between` — group leading content (e.g. `Title` + `Subtitle`) in one wrapper so actions still sit at the end |
| `Sidebar` default width (`w-56`) | pass `className="w-56"` (or any width) explicitly |
| `Sidebar.Footer`'s own `mt-auto` | removed — pin it to the bottom via a `flex-1` scrollable middle section (see `Sidebar` stories), or pass `className="mt-auto"` explicitly |
| `Toolbar.Separator`'s own `mx-1` | removed — spacing now comes from `Toolbar`'s `gap-1` |

**New capability:** `Toast` gains a `viewportClassName` prop to reposition the notification viewport (previously hardcoded to `fixed right-4 bottom-4`).

**Also fixed:** `Input`, `Textarea`, `Select.Trigger`, `Combobox.Input`, `SearchField`, `Field.Control`, `Toolbar.Button`, `Tabs.List`, `Tabs.Tab`, `List.Item`, `NestedList.Item`, `Sidebar.Item`, and `Badge` now share one `sm | md | lg` size scale, replacing inconsistent hardcoded heights (previously `h-8`/`h-7`/`h-6` mismatches across otherwise-equivalent controls). `List.Item`/`NestedList.Item`/`Sidebar.Item` default to `md` (`h-8`), matching their previous `h-7` more closely than `sm` would. `Toolbar.Button` defaults to `sm` (`h-6`/`text-xs`), down from its previous `h-7`/`text-sm` — square icon-only toolbar buttons should size to `size-6`. `PluginHeader.ThemeSwitcher` shrank from `h-7 w-7` to `h-6 w-6` to match. `Badge` gains the full `Tone` scale (previously had no `danger` tone at all), and its own `sm` size now scales the trigger's icon/padding, not just height. `EmptyState`'s internal spacing is now a uniform `gap-3` between icon/title/description/action, replacing bespoke per-child margins.

`surfaceTone` (the shared recipe behind `Button`/`Badge`/`IconButton`) only adds hover states when a caller opts in with `interactive: true` — `Button`/`IconButton` do; `Badge`/`Alert` don't, since neither is clickable.

**Breaking for direct consumers of the exported recipes:** `buttonVariants()` and `badgeVariants()` no longer include color — they cover shape/size only. Color comes from `surfaceTone()`, composed alongside them. A bare `buttonVariants()` call now yields a colorless button.

**Also additive:** `Button` gains a `size="lg"` step; `IndicatorDot` gains a `size` prop (`sm | md | lg`); `ConfirmDialog` now accepts `className`.
