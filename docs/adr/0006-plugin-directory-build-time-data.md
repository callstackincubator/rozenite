# 0006 — Plugin directory data is fetched at build time, without a database

**Status:** Accepted — not yet implemented

**Related:** [callstackincubator/rozenite#486](https://github.com/callstackincubator/rozenite/pull/486),
[callstackincubator/rozenite#535](https://github.com/callstackincubator/rozenite/pull/535)

## Context

The plugin directory at `/plugin-directory` lists every entry in
`plugin-directory.json` with its latest npm version, its npm description and
the star count of its GitHub repository. The site is static: the pages are
rendered once, when the website is deployed.

Until now the data went through a repository layer with two implementations.
A Neon Postgres table cached each plugin for seven days, and a mock repository
returned hardcoded data for four plugins and `v0.0.0` / 0 stars for the rest.
The Neon repository was used only when `USE_DATABASE` was set and `NODE_ENV`
was `production`; otherwise the build fell back to the mock without a word.

Since #486 the Vercel build runs through `pnpm turbo run build`. Turborepo 2
runs tasks in strict env mode, so `USE_DATABASE` and `DATABASE_URL`, which are
not declared in `turbo.json`, never reach Astro. Every production build since
has shipped the mock: made-up versions and star counts for four official
plugins, and `v0.0.0`, 0 stars and "Plugin information not available" for the
other twenty. Nothing failed, and the `errors-only` task logs hid the one
line that said which repository was in use.

The database was never needed for load. A build makes one request per listed
package (24 today) and one per distinct GitHub repository (11 today).

- npm publishes no rate limit for registry reads. Responses are served from
  Cloudflare's cache (`cache-control: public, max-age=300`).
  `/<package>/latest` returns only the latest manifest: about 3 KB, against
  135 KB for the full document the site fetched before.
- GitHub allows 60 unauthenticated requests per hour per IP. GitHub-hosted
  runners share IPs, so that budget is often already spent. The Actions
  `GITHUB_TOKEN` allows 1,000 requests per hour per repository.

The previous GitHub client turned every error into 0 stars, and the Neon
repository then cached that 0 for a week.

## Decision

1. **Fetch at build time, with no database and no mock.** Each build reads
   npm (`https://registry.npmjs.org/<package>/latest`) and GitHub
   (`https://api.github.com/repos/<owner>/<repo>`) directly, in dev as well as
   in production. The Neon repository, the mock repository, the repository
   interface and the `@neondatabase/serverless` dependency are removed.
   `USE_DATABASE` and `DATABASE_URL` stop meaning anything.

2. **One HTTP client deduplicates requests.** All plugin-directory requests go
   through one module-level client that keys requests by URL. Concurrent
   callers share one in-flight request, and a successful response is reused
   for the rest of the process. A failed request is evicted, so a later
   caller retries it. The fifteen official plugins share one repository and
   cause one GitHub request. `/plugin-directory` and `/plugin-directory/1`
   render the same page and cause no second round of requests. Each request
   has a 10-second timeout. A 429 or 5xx response is retried once, after
   `Retry-After` (capped at 10 seconds) or one second.

3. **GitHub requests use the job's `GITHUB_TOKEN` when it is present.** The
   deploy workflow passes `GITHUB_TOKEN: ${{ github.token }}` only to the step
   that runs `vercel build`. `turbo.json` lists it in `passThroughEnv` on
   `@rozenite/docs#build` alone, so no other Turborepo task sees it. It is not
   in `env`, because the token changes every run and would make every build a
   cache miss. Without a token (local builds, CI) requests go out
   unauthenticated.

4. **The deploy fails instead of shipping wrong data.** The deploy workflow
   sets `PLUGIN_DIRECTORY_STRICT=true`, declared in `passThroughEnv` next to
   the token. In strict mode the build fails when an official (`@rozenite/*`)
   plugin cannot be loaded, or when any request fails for a reason other than
   404. A third-party package or repository that returns 404 is still listed,
   without the missing data, and logged. Without the flag (local and CI
   builds) every failure is logged and the card is shown without that data.

5. **Missing data is not shown.** A card with no version, or no star count,
   leaves that element out. It never shows `v0.0.0` or 0 stars in its place.
   A card with no description keeps the generic description it has today.

6. **Entries in `plugin-directory.json` are validated.** `npmUrl` must be
   `https://www.npmjs.com/package/<name>`, where `<name>` is a valid npm
   package name. `githubUrl` must be an `https://github.com/<owner>/<repo>`
   URL, optionally followed by a path. Any other entry fails the build, strict
   or not. `plugin-directory.json` becomes a Turborepo input of
   `@rozenite/docs#build`. A pull request that edits only the directory then
   rebuilds the site in CI, and a stale cache can no longer hide an edit.

## Security considerations

- **Who sees the token.** It reaches every process started by the `vercel
  build` step: the `installCommand` (`pnpm install`, which runs only the
  install scripts allowlisted in `allowBuilds`) and the
  `@rozenite/docs#build` task. Turborepo's strict env mode keeps it from every
  other task, including the Storybook and package builds. The token lasts only
  as long as the job. The `release.yml` caller limits it to `contents: read`
  on a public repository, so a stolen token reads only what is already
  public. The same job already holds `VERCEL_TOKEN` and the Vercel production
  env, which are worth far more.
- **What can leak where.** The token goes only in the `Authorization` header
  of requests to `api.github.com`. It is never logged, interpolated into a URL
  or rendered. Error messages carry the URL and the status, never request
  headers.
- **Content from outside the repository.** `plugin-directory.json` is
  contributed through pull requests, and npm descriptions are written by
  package authors.
  - Owner, repository and package names are validated, then URL-encoded, before
    they become a request path. A crafted entry therefore cannot make an
    authenticated request to any GitHub endpoint other than
    `GET /repos/<owner>/<repo>`.
  - Because both URLs are validated, the `href`s the page renders are always
    `https://github.com/…` and `https://www.npmjs.com/…`, never `javascript:`.
  - Astro escapes descriptions when it renders them.
- **Damage a third party can do.** A third party who unpublishes a package or
  deletes a repository makes that card lose its data. That card is all they
  can affect: they cannot fail the deploy or change any other card.
- **Fewer secrets.** Removing Neon takes `DATABASE_URL`, a credential that
  could write to the database, out of the build.

## Consequences

- The data is as fresh as the last deploy. The site is deployed on every
  stable release. Refreshing it more often (for example, a scheduled deploy)
  is a separate decision.
- A deploy depends on npm and GitHub being up. An outage fails the deploy, and
  re-running the workflow is the fix.
- A local `pnpm --filter @rozenite/docs dev` needs the network to show real
  data. Offline, cards render without a version or stars.
- `USE_DATABASE` and `DATABASE_URL` can be deleted from the Vercel project,
  and the Neon database can be retired. Both are done outside the
  repository.
