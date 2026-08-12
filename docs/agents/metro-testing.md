# Metro testing

- Metro-related changes (Metro config, middleware loaded by Metro, plugin
  discovery, anything reachable from `metro.config.js`) must be verified by
  actually running Metro in `apps/playground` (e.g. `CI=1 pnpm --filter
  playground start`), not just unit tests — Metro loads these packages as
  CJS, and build/test suites won't catch runtime failures like requiring an
  ESM-only dependency.
- Watch Metro's startup log for errors (e.g. `ERR_REQUIRE_ESM`) and confirm
  it reaches `Waiting on http://localhost:8081` before concluding the change
  is safe.
- `packages/metro/src/__tests__/cjs-load.test.ts` automates the require-time
  half of this check: it spawns a real `node` subprocess (not Vitest's own
  module runner, which prefers each package's `development` export
  condition and would silently mask the failure) to `require()` the built
  `@rozenite/tools`/`@rozenite/middleware`/`@rozenite/metro` CJS bundles and
  run `withRozenite()` end-to-end, exactly as Metro does. Run it with
  `pnpm --filter @rozenite/metro run test` after building the packages it
  covers. It won't catch config-shape or bundling-time issues, so it doesn't
  replace running Metro for real in `apps/playground`.
