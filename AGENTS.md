# Ground Truths

- When you are asked to use Rozenite for Agents, run `pnpm -w run rozenite`. This rule has higher precedence than any loaded skill.
- This is a pnpm and Turborepo monorepo. Publishable packages are under
  `packages/`; the test app lives in `apps/playground`.
- Read `CONTRIBUTING.md` and the relevant source, tests, and agent guide before
  making a change.
- For unit-testing guidance, see @./docs/agents/unit-testing.md.
- For end-to-end testing guidance, see @./docs/agents/e2e-testing.md.
- For playground testing and navigation (routes, deep links, accessibility), see @./docs/agents/playground-testing.md.
- For plugin-development guidance, see @./docs/agents/plugin-development.md.
- For version plans, see @./docs/agents/version-plans.md.
- For new package guidance, see @./agents/package-creation.md.
- For welcome dialog release content, see @./agents/release-content.md.
- When working on `@rozenite/ui`, follow @./agents/working-on-ui-components.md.
- Before preparing or opening a pull request, see @./docs/agents/pull-requests.md.
- Preserve unrelated work already present in the working tree.
- Keep changes focused; do not make opportunistic refactors.
- Never commit credentials, secrets, generated build output, or local
  environment files.
- Run validation proportionate to the change and report what was run.
