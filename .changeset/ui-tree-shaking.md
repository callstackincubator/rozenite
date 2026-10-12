---
'@rozenite/ui': patch
---

Plugin panels now bundle only the `@rozenite/ui` components they use. Importing a single component, such as `Button`, no longer pulls in every other component and its `@base-ui/react` dependencies, which makes the gzipped JavaScript of a panel 5% to 30% smaller.
