# Version plans

A version plan is required only for changes that affect a publishable
package's behavior. Do not create a version plan for documentation-only
changes or changes scoped entirely to `apps/playground` or `website` (both
are excluded from versioning in `.changeset/config.json`).

## Create the plan

1. Generate the Changeset interactively:

   ```sh
   pnpm changeset
   ```

   Follow the prompts to select the affected packages and the appropriate
   version bump. Note that all `@rozenite/*` packages are pinned together
   (see the `fixed` field in `.changeset/config.json`), so picking any one of
   them bumps them all in lockstep.

2. Review the generated Markdown file under `.changeset/`. Package names must
   exactly match their workspace `package.json` names.
3. Write a concise, user-facing summary after the frontmatter. Describe the
   capability, behavior, or fix—not the files or implementation technique.

## Examples

```md
---
'@rozenite/ui': minor
---

Add new `@rozenite/ui` package — shared UI primitives and plugin layout
components built on HeroUI and Tailwind CSS.
```

## Check the plan

Run the following to confirm the branch contains a Changeset relative to
`main`:

```sh
pnpm release:plan
```

This is the same check CI runs and will fail the build if a version plan is
missing for a relevant change. Existing files in `.changeset/` are the
repository's best examples for tone and release scope.
