---
'@rozenite/ui': patch
---

Fix `ScrollArea`'s corner (where the vertical and horizontal scrollbars meet) rendering as an unstyled white square instead of matching the surrounding background. Also style the native `::-webkit-scrollbar-corner` for scrollable elements that don't use `ScrollArea`.
