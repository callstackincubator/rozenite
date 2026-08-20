# Pull requests

Read this guide before preparing or opening a pull request.

## Before opening

1. Ensure the branch addresses one focused change; if it spans multiple
   unrelated types of change (e.g. a feature plus an unrelated refactor),
   split it into separate pull requests.
2. Add a version plan when the change affects a publishable package's
   behavior; see `docs/agents/version-plans.md`.
3. Update the relevant package or `website/` documentation if the change adds
   or alters user-facing behavior.
4. Run and report validation proportionate to the change. From the repository
   root, after making sure the base branch ref is present locally:

   ```
   git fetch origin main
   pnpm checks:affected && pnpm test:affected
   ```

   `--affected` needs that ref to diff against; without it Turborepo treats every
   package as affected and rebuilds the whole monorepo. Reach for the `:all`
   variants only when the change is genuinely repo-wide, such as a release or an
   edit to a root config file. See `docs/agents/validation.md`.
5. Ensure the pull request title follows
   [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary)
   (e.g. `feat(redux-devtools): add some new feature`) — it becomes the squash
   commit title and scope should match the package name.

## Description

Fill in `.github/pull_request_template.md` as-is; do not replace or rename its
sections. Write for the reviewer and for the person affected by the change:

- **Description** — what changed, in plain terms.
- **Related Issue** — link the open issue this addresses; this repository
  only accepts pull requests tied to one (see `CONTRIBUTING.md`).
- **Context** — why this approach was chosen and anything a reviewer needs to
  know before reviewing.
- **Testing** — how the change was verified (commands run, playground steps,
  manual checks).

Do not add extra sections (rollout notes, generated-by footers, etc.) beyond
the template unless the change specifically calls for it.
