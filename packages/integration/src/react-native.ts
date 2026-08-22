import { createRequire } from 'node:module';
import type { ProjectType } from '@rozenite/tools';
import type { RozeniteIntegrationProvider } from './types.js';
import { logger, type RozeniteLogLevel } from '@rozenite/tools';
import { verifyReactNativeVersion } from './verify-react-native-version.js';
import { getReactNativeDebuggerFrontendPath } from './resolve.js';
import { patchDevtoolsFrontendUrl } from './dev-tools-url-patch.js';
import { patchRozeniteIntegrationDomain } from './integration-domain.js';

const require = createRequire(import.meta.url);

export type CreateReactNativeIntegrationOptions = {
  projectRoot: string;
  /**
   * Project type of the project. If not provided, this integration will
   * try to guess it based on the project root.
   */
  projectType?: ProjectType;
  /**
   * Kept in step with the caller's `RozeniteConfig.logLevel` (see
   * `initializeRozenite`) so the resolution and patching this integration
   * does logs at the same verbosity as the rest of the dev server, even
   * though this package can't share the middleware's own logger instance
   * (see `./logger.ts`).
   * @default 'info'
   */
  logLevel?: RozeniteLogLevel;
};

/**
 * The React Native side of `RozeniteIntegrationProvider`: verifies the installed
 * React Native version, resolves and serves Fusebox's debugger frontend,
 * and patches `@react-native/dev-middleware` so it reports `'react-native'`
 * (or the per-connection resolved variant) over the `Rozenite.getEnvironment`
 * CDP domain. This is the default `@rozenite/middleware` falls back to, so
 * `@rozenite/metro` and `@rozenite/repack` need no changes to keep working.
 */
export const createReactNativeIntegration = (
  options: CreateReactNativeIntegrationOptions,
): RozeniteIntegrationProvider => {
  logger.setLevel(options.logLevel ?? 'info');

  return {
    id: 'react-native',
    verifyEnvironment: () => verifyReactNativeVersion(options.projectRoot),
    getDebuggerFrontendPath: () => {
      // `getReactNativeDebuggerFrontendPath` resolves to
      // `@react-native/debugger-frontend`'s package entry, which is a
      // module whose `module.exports` IS the frontend directory string
      // (see that package's `index.js`) - so it must be `require`d, not
      // just resolved, to get a usable path.
      return require(getReactNativeDebuggerFrontendPath(options)) as string;
    },
    installInspectorHooks: () => {
      patchDevtoolsFrontendUrl(options);
      // Lynx does not use dev-middleware, so it has nothing to patch here;
      // its own bridge answers Rozenite.getEnvironment in a follow-up PR
      // (see `@rozenite/lynx-dev`'s integration).
      patchRozeniteIntegrationDomain(options, 'react-native');
    },
  };
};
