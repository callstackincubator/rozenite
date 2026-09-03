export { bundleForRelease } from './metro/bundle-for-release.js';
export type {
  BundleForReleaseOptions,
  ConfigureMetroResult,
  MetroConfig,
  MetroProjectType,
  ReleaseBundle,
} from './metro/bundle-for-release.js';
export {
  isRozeniteModule,
  getRozeniteModules,
  isPanelModule,
  getPanelModules,
} from './metro/rozenite-modules.js';
export { bundleForRelease as bundleLynxForRelease } from './rspeedy/bundle-for-release.js';
export type {
  RspeedyReleaseBundle,
  RspeedyReleaseBundleOptions,
} from './rspeedy/bundle-for-release.js';

/**
 * A cold Metro release build takes a few seconds; give suites using
 * {@link bundleForRelease} a timeout that survives a loaded CI runner.
 * `bundleLynxForRelease` (rspeedy) is comparably slow and uses the same
 * budget.
 */
export const RELEASE_BUNDLE_TIMEOUT = 120_000;
