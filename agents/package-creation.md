# New packages

- Compare with similar packages under `packages/`.
- README must follow the shared repository structure:
  - banner
  - tagline
  - badges
  - description
  - features or exports
  - installation
  - usage
  - Callstack footer and link definitions
- Copy standard `package.json` metadata:
  - `homepage`
  - `bugs`
  - `repository`
  - `author`
  - `license`
  - `publishConfig`
  - `files`
- Library packages must also define matching `main`, `module`, `types`, and `exports` fields.
- Publish an explicit `files` allowlist, never the whole package directory:
  - Ship `dist` plus anything an `exports` target, `bin` or runtime path
    lookup points at (for example `src/metro/setup.js` in
    `@rozenite/require-profiler-plugin`, `templates` in
    `@rozenite/vite-plugin`). Add `!dist/**/*.tsbuildinfo`: `tsc` writes them
    next to the output whenever `typecheck` runs before a pack.
  - Do not ship `rozenite.config.ts` (dev-host fixtures and flows),
    `__tests__`, `*.test.*`, `vitest.setup.ts`, `vite.config.ts`,
    `tsconfig*.json` or lint config.
  - `README`, `LICENSE` and `package.json` are always included; `CHANGELOG.md`
    is not, so list it in every package that has one (the plugin template
    has none).
- Keep `development` out of what is published. A `development` condition in
  `exports` points at TypeScript source and exists for this workspace only
  (`customConditions` in `tsconfig.base.json` and the plugin tsconfigs, and the
  playground's webpack `conditionNames`). Consumers' bundlers also turn it on
  in dev mode (webpack, Rspack and Vite do), so a published `development`
  target that is missing, or that is TypeScript under `node_modules`, breaks
  their dev builds. The `beforePacking` hook in the root `.pnpmfile.cjs`
  removes the condition from every package's `exports` for `pnpm pack` and
  `pnpm publish`, so there is nothing to configure per package; edit the file
  and run `pnpm install` (it updates `pnpmfileChecksum` in the lockfile) if the
  rule has to change. Do not ship `src` or `sdk.ts` to satisfy it, and do not
  add `development` to a plugin's `./sdk` export: `rozenite build` manages that
  entry, drops the `./sdk.ts` value it used to write, and keeps a different
  `development` value an author wrote. Authors outside this workspace who keep
  one have to hide it themselves, for example with `publishConfig.exports`
  (pnpm only); `rozenite build` keeps the managed entries of an existing
  `publishConfig.exports` in step.
- Every publishable package owns a `package-contents` test (see
  `src/__tests__/package-contents.test.ts`) that packs the built package and
  checks it with `inspectPackedPackage` from `@rozenite/test-utils/packaging`:
  every `exports`/`main`/`module`/`types`/`bin` target is in the tarball, the
  published `exports` is the source `exports` minus `development`, no test,
  fixture or `rozenite.config.*` file ships, and no shipped module imports a
  file that was left out. It runs with the package's other tests, so
  `pnpm test:affected` runs it whenever the package or a dependency changes.
- Use package-specific npm links in README badges and links.
- Run formatting and package checks before opening a PR.
