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
| `Toolbar.Separator`'s own `mx-1` | removed — spacing now comes from `Toolbar`'s `gap-1` |

**New capability:** `Toast` gains a `viewportClassName` prop to reposition the notification viewport (previously hardcoded to `fixed right-4 bottom-4`).

**Also fixed:** `Input`, `Textarea`, `Select.Trigger`, `Combobox.Input`, `SearchField`, `Field.Control`, `Toolbar.Button`, `Tabs.List`, `Tabs.Tab`, `List.Item`, `NestedList.Item`, `Sidebar.Item`, and `Badge` now share one `sm | md | lg` size scale, replacing inconsistent hardcoded heights (previously `h-8`/`h-7`/`h-6` mismatches across otherwise-equivalent controls). `Badge` gains the full `Tone` scale (previously had no `danger` tone at all).
