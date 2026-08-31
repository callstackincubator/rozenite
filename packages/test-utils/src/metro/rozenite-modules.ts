import path from 'node:path';
import { monorepoRoot, packagesRoot } from './paths.js';

const NODE_MODULES_SCOPE = `${path.sep}node_modules${path.sep}@rozenite${path.sep}`;

/**
 * Whether a module included in a bundle comes from Rozenite.
 *
 * Two shapes have to be covered: a consumer installing Rozenite from npm
 * (`node_modules/@rozenite/*`) and this monorepository, where workspace
 * packages resolve straight to `packages/*` through pnpm's links.
 */
export const isRozeniteModule = (modulePath: string): boolean => {
  if (modulePath.includes(NODE_MODULES_SCOPE)) {
    return true;
  }

  const relativeToPackages = path.relative(packagesRoot, modulePath);

  return (
    relativeToPackages.length > 0 &&
    !relativeToPackages.startsWith('..') &&
    !path.isAbsolute(relativeToPackages)
  );
};

/**
 * Makes a module path readable in assertion output, trimming the
 * monorepository root when the module lives inside it.
 */
export const formatModulePath = (modulePath: string): string => {
  const relative = path.relative(monorepoRoot, modulePath);

  return relative.startsWith('..') ? modulePath : relative;
};

export const getRozeniteModules = (modulePaths: readonly string[]): string[] =>
  modulePaths.filter(isRozeniteModule).map(formatModulePath).sort();

// A plugin's panel is its DevTools UI: React DOM components under
// `devtools`/`ui`, and anything from `@rozenite/ui`. It is served to the
// DevTools frontend over the dev server and has no business in an app.
const PANEL_SEGMENTS = new Set(['devtools', 'panel', 'ui']);

export const isPanelModule = (modulePath: string): boolean =>
  isRozeniteModule(modulePath) &&
  modulePath.split(path.sep).some((segment) => PANEL_SEGMENTS.has(segment));

export const getPanelModules = (modulePaths: readonly string[]): string[] =>
  modulePaths.filter(isPanelModule).map(formatModulePath).sort();
