import path from 'node:path';

export const getNodeModulesPaths = (): readonly string[] => {
  const paths: string[] = [];

  // Add current working directory node_modules
  paths.push(path.join(process.cwd(), 'node_modules'));

  // Add parent directories node_modules (for monorepos)
  let currentDir = process.cwd();
  let parentDir = path.dirname(currentDir);

  while (parentDir !== currentDir) {
    const parentNodeModules = path.join(parentDir, 'node_modules');
    if (parentNodeModules) {
      paths.push(parentNodeModules);
    }
    currentDir = parentDir;
    parentDir = path.dirname(currentDir);
  }

  return paths;
};
