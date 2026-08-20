# Validation

How to run checks in this repository without rebuilding all 38 packages for a
two-file change.

## Commands

Prefer the `:affected` variants. They diff against the base branch and run only
the packages your change actually touches, plus their dependents.

| Purpose                  | Command                  |
| ------------------------ | ------------------------ |
| Typecheck + lint + format| `pnpm checks:affected`   |
| Tests                    | `pnpm test:affected`     |
| Individual tasks         | `pnpm typecheck:affected`, `pnpm lint:affected`, `pnpm build:affected` |

For a typical pull request, both of these together are the expected validation:

```
git fetch origin main
pnpm checks:affected && pnpm test:affected
```

Use the `:all` variants (`pnpm checks:all`, `pnpm test:all`) only when the change
is genuinely repo-wide — a release, or an edit to a root config file such as
`tsconfig.base.json`, `eslint.config.mjs`, or `pnpm-workspace.yaml`.

## The base branch ref must exist locally

`--affected` compares against the base branch. If that ref is missing — common in
a fresh worktree or a shallow clone — Turborepo silently treats **every** package
as affected and does the expensive thing anyway. Fetch it first:

```
git fetch origin main
```

CI does the same thing (see the "Fetch base branch" step in
`.github/workflows/ci.yml`) and sets `TURBO_SCM_BASE` explicitly.

## The Turborepo cache is already shared between worktrees

Turborepo detects git worktrees and points them all at the main checkout's
`.turbo/cache` (`Using shared worktree cache` in `turbo --dry`/`-vv` output), so
a new worktree does **not** start cold. Do not set `TURBO_CACHE_DIR` to work
around a problem that does not exist; the cache key is content-based, so
identical code hits the cache from any worktree.

`TURBO_CACHE_DIR` is only useful for a genuinely separate *clone*, which does not
share the main checkout's `.turbo`.

## Task output is quiet by default

`turbo.json` sets `outputLogs` so that successful, cached work stays quiet:
`build` and `typecheck` print only on failure, `lint` and `test` print on real
runs but not on cache replays. Failures always print in full. To see everything,
put the flag on the `turbo` command itself — passing it through `pnpm run` would
forward it to ESLint instead:

```
npx turbo run lint --affected --output-logs=full
```

## Which tasks need a build first

Worth knowing before "fixing" `turbo.json`:

- **`lint`** does not depend on `build`. The shared ESLint config
  (`eslint.config.mjs`) uses `typescript-eslint`'s `recommended` preset with no
  `parserOptions.project` or `projectService`, so no rule ever builds a
  TypeScript program or reads a `.d.ts`. It cannot detect a stale or missing
  build, and adding a build dependency only costs time — measured at 59.5s
  versus 9.6s to lint the 29 non-playground packages from cold.
- **`@rozenite/playground#lint`** is the exception and *does* depend on
  `^build`. It runs `expo lint`, and `eslint-config-expo` enables
  `eslint-plugin-import`, whose `import/no-unresolved` rule resolves
  `@rozenite/*` imports to `dist`. Without the build it reports false failures.
  Its script passes `--no-cache` deliberately: `expo lint` otherwise keeps an
  ESLint cache under the gitignored `.expo/`, which Turborepo cannot see, so a
  lint run made before the workspace packages were built keeps replaying its
  stale `import/no-unresolved` failures even after `dist/` exists. Turborepo
  already caches the task, and the flag costs about 0.3s.
- **`typecheck`** and **`test`** depend on builds and must keep doing so.

## Installing

There is no `.npmrc`; all pnpm settings live in `pnpm-workspace.yaml`.

```
pnpm install --frozen-lockfile
```

`pnpm-workspace.yaml` sets `loglevel: warn`, so a successful install prints
nothing at all (a cold install drops from 82 lines to 0). Warnings and errors
still print, and this setting does not affect `pnpm run` output, so Turborepo
task logs are untouched. Use `pnpm install --loglevel=info` to get the progress
and dependency-diff output back.

Do not reach for `--prefer-offline` here. It only speeds up resolving version
*ranges*, and a lockfile install does not resolve any — measured at 20.9s versus
21.7s for a cold install of this repository, i.e. no gain. It does change
behaviour: once pnpm's metadata cache goes stale it resolves against that cache
instead of revalidating, so `pnpm add`/`pnpm update` can silently pick an older
version than the one published (reproduced: `semver@^7.0.0` resolving to 7.6.0
rather than 7.8.5).
