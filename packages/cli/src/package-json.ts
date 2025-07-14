import fs from 'node:fs/promises';

export type PackageJSON = {
  name: string;
  version: string;
};

export const getPackageJSON = async (): Promise<PackageJSON> => {
  return JSON.parse(
    await fs.readFile(new URL('../package.json', import.meta.url), 'utf8')
  );
};
