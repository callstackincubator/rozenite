# Working on UI components

When changing `@rozenite/ui`:

- Use Storybook in `apps/ui-storybook` to develop and test the component.
- Start it from the repo root: `pnpm start:ui-storybook`.
- Find stories in `apps/ui-storybook/src/stories`.
- Add or update the story for every behavior you change.
- Use `agent-browser` for browser interactions and visual checks.
- Load its CLI instructions first: `agent-browser skills get agent-browser`.
- Open Storybook at `http://localhost:6006`.

## Look and feel

The panel UI shares the rozenite.dev look. Read the
[DevTools panel UI](../docs/DESIGN.md#devtools-panel-ui) section of `docs/DESIGN.md` before
changing how anything looks; it has the token table, type roles and component rules. In short:

- Colour only through the tokens in `packages/ui/styles.css` (`bg-muted`, `text-faint`,
  `border-border-strong`, `bg-primary`, …). No raw hex, no Tailwind palette colours
  (`violet-500`, `gray-400`), no new tokens without adding them to both themes and to the
  table in `docs/DESIGN.md`.
- Anything that labels (button, tab, badge, table header, group label, metadata) uses
  `monoLabel` from `src/utils/mono-label.ts` plus a size. Sentences never do, and neither
  does case-sensitive data (keys, versions, URLs): opt out with `normal-case tracking-normal`.
- Square corners, 1px hairlines, no shadows, no gradients, no blur. Indicators are squares.
- The accent is for the primary action, the selected item and live state. Status uses the
  `success`, `warning`, `danger` and `info` tones, never `primary`.
- Hover and colour transitions are `duration-[120ms]`.
- Check every change in both themes (`PluginHeader.ThemeSwitcher`, or the `Dark` and `Light`
  stories of `Preview / Design refresh`) and keep every text pair at 4.5:1 or above.
- When a component changes visibly, check it in `Preview / Design refresh` too, so the
  composed panel stays the reference.
