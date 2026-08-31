/**
 * The integration vocabulary, shared by every party that has to agree on
 * it: the Vite plugin that writes `integrations` into a plugin manifest,
 * the middleware that knows which host it serves, and the DevTools hosts
 * that resolve which integration a connected target actually is.
 *
 * This module deliberately has NO imports. It is published as the
 * `@rozenite/tools/integration` subpath so the browser-side hosts
 * (`@rozenite/app`, `@rozenite/runtime`) can share it without pulling the
 * package's Node-only entry point into a browser bundle.
 */

/** A target environment a plugin can declare support for. */
export type RozeniteIntegration = 'react-native' | 'react-native-web' | 'lynx' | 'lynx-web';

/**
 * What a dev server can serve. The `-web` variants are per-target
 * refinements, not server modes: one Metro serves a native app and a
 * browser tab at once, so the host itself is either `react-native` or
 * `lynx` — which target is being talked to is resolved per-connection by
 * `resolveIntegration` below.
 */
export type RozeniteHostIntegration = 'react-native' | 'lynx';

export const ROZENITE_INTEGRATIONS: readonly RozeniteIntegration[] = [
  'react-native',
  'react-native-web',
  'lynx',
  'lynx-web',
];

export const isRozeniteIntegration = (value: unknown): value is RozeniteIntegration =>
  typeof value === 'string' && (ROZENITE_INTEGRATIONS as readonly string[]).includes(value);

/**
 * Plugins published before this feature declared nothing; they all target
 * React Native, so that's the assumed compatibility for an unlabeled plugin.
 */
export const DEFAULT_PLUGIN_INTEGRATIONS: readonly RozeniteIntegration[] = ['react-native'];

/**
 * The expression a DevTools host evaluates in the DEVICE's JS runtime to
 * find out whether that target is a browser.
 *
 * Why the host asks the device rather than inferring it: the device is the
 * only party that knows for certain, and it is a party Rozenite controls.
 * The alternative — reading the `platform` field off React Native's
 * `ReactNativeApplication.metadataUpdated` — means eavesdropping on an
 * event we neither emit nor can order against anything else, so a host
 * that asks early gets an answer that looks identical to a real one but
 * reports a browser target as native.
 *
 * Deliberately self-contained, and deliberately NOT a call into
 * `@rozenite/plugin-bridge`'s `isWeb()`. `plugin-bridge` is installed in
 * the *user's* app and versions independently of the dev server, so
 * calling into it would make the answer depend on how old the app's copy
 * is. Inline `typeof` checks depend on nothing.
 *
 * Evaluated at global scope, so it can only read genuine globals. That is
 * also why it does not try to detect Lynx: Lynx injects its `lynx` binding
 * into each bundle's MODULE scope, not onto `globalThis` (see
 * `packages/plugin-bridge/src/web.ts`), so it is invisible from here. The
 * host half of the answer therefore comes from the dev server's own
 * configuration, which knows it without guessing.
 */
export const IS_WEB_TARGET_EXPRESSION =
  "typeof window !== 'undefined' && typeof window.document !== 'undefined'";

/**
 * Resolves which integration a connected target is, from the host this dev
 * server serves and whether that target turned out to be a browser.
 *
 * The four ids are exactly `host` and `host-web` for the two hosts, so
 * this is a derivation rather than a lookup table — `integration.test.ts`
 * asserts it generates precisely `ROZENITE_INTEGRATIONS` so the two cannot
 * drift apart.
 */
export const resolveIntegration = (
  host: RozeniteHostIntegration,
  isWebTarget: boolean,
): RozeniteIntegration => {
  return isWebTarget ? (`${host}-web` as RozeniteIntegration) : host;
};
