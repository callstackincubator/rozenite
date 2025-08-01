import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const getDevModePackage = (
  projectRoot: string
): { name: string; path: string } | null => {
  const packageName = process.env.ROZENITE_DEV_MODE;

  if (!packageName) {
    return null;
  }

  const packagePath = path.dirname(
    require.resolve(packageName, { paths: [projectRoot] })
  );

  return {
    name: packageName,
    path: packagePath,
  };
};
