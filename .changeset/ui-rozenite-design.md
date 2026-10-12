---
'@rozenite/ui': minor
---

`@rozenite/ui` now has the rozenite.dev look: a near-black theme with the
crimson-rose accent (a deeper crimson in the light theme), Geist and Geist
Mono bundled with the package, uppercase mono labels on buttons, tabs, badges
and table headers, hairline tabs with an accent underline, an accent bar on
the selected sidebar item, square switches and indicators, and no shadows.
Status colours stay distinct from the accent: errors are orange-red. The
`Text` component gains a `label` variant for metadata, and the theme adds
`faint`, `surface`, `border-strong` and `primary-hover` colours. Component
APIs are unchanged; panels built with `@rozenite/ui` pick up the new look
without code changes.
