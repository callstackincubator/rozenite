---
'@rozenite/ui': patch
---

Fix `Toolbar.Button` not visually dimming or disabling hover/pointer interaction when `disabled`. The component only ever set `aria-disabled` (not the native `disabled` attribute or `data-disabled`), so its styles were targeting a selector that never matched.
