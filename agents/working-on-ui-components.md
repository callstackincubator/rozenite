# Working on UI components

When changing `@rozenite/ui`:

- Use Storybook in `apps/ui-storybook` to develop and test the component.
- Start it from the repo root: `pnpm start:ui-storybook`.
- Find stories in `apps/ui-storybook/src/stories`.
- Add or update the story for every behavior you change.
- Use `agent-browser` for browser interactions and visual checks.
- Load its CLI instructions first: `agent-browser skills get agent-browser`.
- Open Storybook at `http://localhost:6006`.
