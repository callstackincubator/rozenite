import fs from 'node:fs';
import { createRequire } from 'node:module';
import semver from 'semver';
import { logger } from '@rozenite/tools';

const REQUIRED_REPACK_VERSION = '5.2';

const require = createRequire(import.meta.url);

export const getRepackPackageJsonPath = (
  projectRoot: string
): string | null => {
  try {
    return require.resolve('@callstack/repack/package.json', {
      paths: [projectRoot],
    });
  } catch {
    return null;
  }
};

export const assertSupportedRePackVersion = (projectRoot: string): void => {
  const packageJsonPath = getRepackPackageJsonPath(projectRoot);

  if (!packageJsonPath) {
    logger.error(
      `Re.Pack is not installed in the project. Please install it to continue using Rozenite.`
    );
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const repackVersion = packageJson.version;

  if (semver.satisfies(repackVersion, `>=${REQUIRED_REPACK_VERSION}`)) {
    return;
  }

  logger.error(
    `Rozenite requires Re.Pack ${REQUIRED_REPACK_VERSION} or higher.\n` +
      `   Current version: ${repackVersion}\n` +
      `   Please upgrade your Re.Pack version to continue using Rozenite.`
  );
  process.exit(1);
};
