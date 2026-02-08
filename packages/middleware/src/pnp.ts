import path from 'path';

export const isPnP = (): boolean => {
  return typeof process.versions.pnp !== 'undefined';
}

export interface VirtualPath {
  packageName: string;
  basePath: string;
}

export const resolvePackagePathFromVirtualPath = (virtualPath: string): VirtualPath => {
  const nodeModulesPath = `node_modules${path.sep}`;
  const nodeModulesIndex = virtualPath.lastIndexOf(nodeModulesPath);

  if (nodeModulesIndex === -1) {
    throw new Error(`Could not find package path: ${virtualPath}`);
  }

  const afterNodeModules = virtualPath.substring(nodeModulesIndex + nodeModulesPath.length);
  const beforeNodeModules = virtualPath.substring(0, nodeModulesIndex + nodeModulesPath.length);
  let packageSegments: number;
  
  if (afterNodeModules.startsWith('@')) {
    // Scoped package
    packageSegments = 2;
  } else {
    // Non-scoped package
    packageSegments = 1;
  }

  const parts = afterNodeModules.split(path.sep);
  const packageName = parts.slice(0, packageSegments).join(path.sep);

  return {
    packageName: packageName,
    basePath: beforeNodeModules + packageName,
  };
}
