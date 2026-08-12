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
