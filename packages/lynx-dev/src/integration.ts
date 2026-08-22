/**
 * Lynx's `RozeniteIntegrationProvider`: the counterpart to
 * `@rozenite/integration`'s `createReactNativeIntegration`, but for the host
 * this package serves instead of React Native.
 *
 * Every member is a no-op or `null` because Lynx genuinely has nothing to
 * do here yet:
 *
 * - `verifyEnvironment`: Lynx apps have no `react-native` dependency to
 *   version-check, so there's nothing to preflight.
 * - `getDebuggerFrontendPath`: unlike Fusebox, Lynx has no embedded
 *   debugger frontend - `@rozenite/app` is served standalone instead (see
 *   `getMiddleware` in `@rozenite/middleware`, which serves `/app` either
 *   way).
 * - `installInspectorHooks`: Lynx does not use
 *   `@react-native/dev-middleware`, so there is no inspector proxy to patch
 *   for the `Rozenite.getEnvironment` CDP domain - `./server`'s own bridge
 *   will answer that domain itself in a follow-up PR.
 */
import type { RozeniteIntegrationProvider } from '@rozenite/integration';

export const lynxIntegration = (): RozeniteIntegrationProvider => ({
  id: 'lynx',
  verifyEnvironment: () => {},
  getDebuggerFrontendPath: () => null,
  installInspectorHooks: () => {},
});
