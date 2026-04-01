# Releasing

## Stable releases

Stable releases run from `main` via `.github/workflows/release.yml`.

1. Merge changesets into `main`.
2. The release workflow runs on every push to `main`.
3. `changesets/action` creates or updates the release PR while unpublished changesets exist.
4. After the release PR is merged, the same workflow publishes released packages to npm with the default `latest` dist-tag.

The workflow runs:

```sh
pnpm release:check
pnpm release:publish
```

`release:publish` reruns validation, builds publishable packages, and then calls `changeset publish`.

## Prereleases

Prereleases run manually with `.github/workflows/prerelease.yml`.

Inputs:

1. `mode`: `rc` or `canary`
2. `ref`: required git ref to check out

The workflow installs dependencies and runs:

```sh
pnpm release:prerelease
```

### RC releases

Use `release/<minor>` or `release/<version>` branches, for example `release/1.7` or `release/2.0`.

`rc` mode is intentionally restricted to `release/*` branches and will fail on `main`.

First `rc` run on a release branch:

1. `changeset pre enter rc`
2. `changeset version`
3. commit versioned files to the release branch
4. push the release branch
5. `pnpm release:check`
6. `pnpm release:build`
7. `changeset publish`

Subsequent `rc` runs:

1. add more changesets on the same release branch
2. rerun the prerelease workflow in `rc` mode
3. `changeset version`
4. commit and push updated prerelease state
5. publish to the `rc` dist-tag

Exit `rc` mode manually on the release branch when ready:

```sh
pnpm changeset pre exit
pnpm changeset version
git add .changeset packages package.json pnpm-lock.yaml CHANGELOG.md
git commit -m "Exit prerelease mode"
git push
```

Merge that branch back through the normal stable release flow.

### Canary releases

Use `canary` mode for snapshot releases from any chosen ref.

The workflow:

1. runs `changeset version --snapshot canary`
2. runs `pnpm release:check`
3. runs `pnpm release:build`
4. runs `changeset publish --tag canary --no-git-tag`

Snapshot version changes are not committed or pushed.

## Dist-tags

npm publish behavior relies on Changesets defaults:

1. stable publishes to `latest`
2. `rc` publishes to `rc`
3. `canary` publishes to `canary`

Examples:

```sh
npm install rozenite
npm install rozenite@rc
npm install rozenite@canary
```

Installing without a tag must never pull prereleases.

## Package metadata

All public packages under `packages/*` that are meant to publish to npm declare:

```json
"publishConfig": {
  "access": "public"
}
```

Packages intentionally excluded from publishing remain untouched:

1. `packages/chrome-extension/package.json`
2. `packages/cli/template/package.json`
3. `apps/playground/package.json`
4. `website/package.json`

## Trusted publishing

Configure npm trusted publishing per public package.

For each package on npm:

1. Open package settings.
2. Add a GitHub Actions trusted publisher.
3. Set org/user to `callstackincubator`.
4. Set repo to `rozenite`.
5. Add workflow `release.yml` for stable releases.
6. Add workflow `prerelease.yml` for prereleases.

Notes:

1. Trusted publishers are configured per package.
2. GitHub-hosted runners are required.
3. Provenance should be automatic for public packages from this public repository.
4. After verification, token-based publish access can be restricted or disabled.

## Scripts

Root release scripts:

```json
{
  "release:check": "pnpm turbo run typecheck build lint test",
  "release:build": "pnpm build:all",
  "release:publish": "pnpm release:check && pnpm release:build && changeset publish",
  "release:prerelease": "node scripts/release/prerelease.mjs"
}
```

## Validation checklist

Before the first real publish:

1. Verify all public package manifests include `publishConfig.access = \"public\"`.
2. Verify private workspaces remain excluded.
3. Verify `changeset publish` skips `@rozenite/chrome-extension`.
4. Verify representative `npm pack --dry-run` output for a few packages.
5. Verify `repository.url` is consistent on published packages.
6. Dry-run workflow logic on a test branch before the first real publish.
