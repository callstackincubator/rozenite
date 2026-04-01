# Releasing

## Workflow

All releases run manually via `.github/workflows/release.yml` using `workflow_dispatch`.

Inputs:

1. `mode`: `stable`, `rc`, or `canary`
2. `ref`: required git ref to check out

The workflow installs dependencies and runs:

```sh
pnpm release:run
```

Trusted publishing should point every public package at the single workflow filename `release.yml`.

## Stable releases

Stable releases run manually from `main`.

1. Merge changesets into `main`.
2. Run the release workflow with `mode=stable` and `ref=main`.
3. The release runner calls `changeset version`.
4. The runner refreshes `pnpm-lock.yaml`.
5. The runner commits version and changelog changes to `main`.
6. The runner runs validation and build steps.
7. The runner publishes packages to npm with the default `latest` dist-tag.
8. The runner creates one annotated monorepo tag like `v1.7.0` and pushes it.

## Prereleases

Prereleases also run manually with `.github/workflows/release.yml`.

### RC releases

Use `release/<minor>` or `release/<version>` branches, for example `release/1.7` or `release/2.0`.

`rc` mode is intentionally restricted to `release/*` branches and will fail on `main`.

First `rc` run on a release branch:

1. `changeset pre enter rc`
2. `changeset version`
3. refresh `pnpm-lock.yaml`
4. commit versioned files to the release branch
5. run `pnpm release:check`
6. run `pnpm release:build`
7. publish to npm under `rc`
8. push the release branch
9. create one annotated monorepo tag like `v1.7.0-rc.0` and push it

Subsequent `rc` runs:

1. add more changesets on the same release branch
2. rerun the prerelease workflow in `rc` mode
3. `changeset version`
4. refresh `pnpm-lock.yaml`
5. commit and publish updated prerelease state
6. push the branch and the new monorepo tag

Exit `rc` mode manually on the release branch when ready:

```sh
pnpm changeset pre exit
pnpm changeset version
pnpm install --lockfile-only
git add .changeset packages package.json pnpm-lock.yaml CHANGELOG.md
git commit -m "Exit prerelease mode"
git push
```

Merge that branch back through the normal stable release flow.

### Canary releases

Use `canary` mode for snapshot releases from any chosen ref.

The workflow:

1. runs `changeset version --snapshot canary`
2. refreshes `pnpm-lock.yaml`
3. runs `pnpm release:check`
4. runs `pnpm release:build`
5. runs `changeset publish --tag canary --no-git-tag`

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
5. Add workflow `release.yml`.

Notes:

1. Trusted publishers are configured per package.
2. GitHub-hosted runners are required.
3. Provenance should be automatic for public packages from this public repository.
4. After verification, token-based publish access can be restricted or disabled.

## Trusted publishing workflow input

When configuring npm trusted publishing, use the single workflow filename `release.yml`.

All releases run through `workflow_dispatch` with:

```text
mode=stable | rc | canary
ref=<git ref>
```

## Git tags

Changesets package-level git tags are disabled during publish.

Instead, the release runner creates one annotated monorepo tag per stable or rc release:

1. stable: `v<version>`
2. rc: `v<version>` where `<version>` includes the rc suffix

Canary releases do not create git tags.

## Scripts

Root release scripts:

```json
{
  "release:check": "pnpm turbo run typecheck build lint test",
  "release:build": "pnpm build:all",
  "release:publish": "changeset publish --no-git-tag",
  "release:run": "node scripts/release/release.mjs"
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
