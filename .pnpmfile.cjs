// Published manifests must not carry the workspace-only `development` export
// condition: it points at TypeScript source that is not in the tarball, and
// webpack, Rspack and Vite turn it on in dev mode. Runs for `pnpm pack` and
// `pnpm publish` (which `changeset publish` uses), for every package.
//
// pnpm records this file's checksum in pnpm-lock.yaml (`pnpmfileChecksum`), so
// after editing it run `pnpm install` and commit the lockfile, or
// `pnpm install --frozen-lockfile` fails. `npm publish` ignores it.
const withoutDevelopment = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'development')
      .map(([key, entry]) => [key, withoutDevelopment(entry)]),
  );
};

module.exports = {
  hooks: {
    beforePacking(pkg) {
      if (pkg.exports) {
        pkg.exports = withoutDevelopment(pkg.exports);
      }

      return pkg;
    },
  },
};
