import { readFileSync } from 'node:fs';
import path from 'node:path';

export const getBinaryRelativePath = (
  projectRoot: string,
  packageName: string
): string | null => {
  try {
    const packagePath = require.resolve(`${packageName}/package.json`, {
      paths: [projectRoot],
    });
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    const binRelativePath = packageJson.bin?.[packageName];

    if (!binRelativePath) {
      return null;
    }

    return path.join(packageName, binRelativePath);
  } catch {
    return null;
  }
};
