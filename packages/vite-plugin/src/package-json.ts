import path from 'node:path';
import fs from 'node:fs/promises';

export type PackageJSON = {
  name: string;
  description: string;
  version: string;
};

export const getPackageJSON = async (
  projectRoot: string
): Promise<PackageJSON> => {
  const packageJSONPath = path.join(projectRoot, 'package.json');
  const packageJSON = await fs.readFile(packageJSONPath, 'utf8');
  return JSON.parse(packageJSON);
};
