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
  - Ship `dist` and anything an `exports` target, `bin` or runtime path
    lookup points at. Plugins with an `sdk.ts` also ship `sdk.ts` and `src`
    (the `./sdk` export has a `development` condition pointing at them),
    minus tests.
  - Do not ship `rozenite.config.ts` (dev-host fixtures and flows),
    `__tests__`, `*.test.*`, `vitest.setup.ts`, `vite.config.ts`,
    `tsconfig*.json` or lint config.
  - `README`, `LICENSE` and `package.json` are always included; `CHANGELOG.md`
    is not, so list it.
  - Compare `pnpm pack` output before and after any change to `files`.
- Use package-specific npm links in README badges and links.
- Run formatting and package checks before opening a PR.
