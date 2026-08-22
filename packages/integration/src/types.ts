import { type RozeniteHostIntegration } from '@rozenite/tools';

/**
 * What one host integration does differently. Every member exists because
 * `@rozenite/middleware` used to branch on `isLynx` to decide it - see
 * `createReactNativeIntegration` (React Native) and `@rozenite/lynx-dev`
 * (Lynx) for the two implementations.
 *
 * Distinct from `RozeniteIntegration` in `@rozenite/tools`, which is a
 * target-environment id a plugin declares compatibility with. This is the
 * runtime object implementing a *host*'s side of serving Rozenite; its
 * `id` is one of those ids.
 */
export type RozeniteIntegrationProvider = {
  id: RozeniteHostIntegration;
  /**
   * Preflight the project. May throw (React Native missing entirely) or
   * exit the process with a message (React Native present but too old) -
   * see `verifyReactNativeVersion`, whose behaviour this preserves.
   */
  verifyEnvironment(): void;
  /**
   * The debugger frontend directory to serve, or `null` when this
   * integration has none and the standalone `@rozenite/app` is used
   * instead.
   */
  getDebuggerFrontendPath(): string | null;
  /**
   * Install any hooks this integration needs in the bundler's dev server.
   * Called once during `initializeRozenite`.
   */
  installInspectorHooks(): void;
};
