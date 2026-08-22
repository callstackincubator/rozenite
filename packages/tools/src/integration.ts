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

export const ROZENITE_INTEGRATION_LABEL: Record<RozeniteIntegration, string> = {
  'react-native': 'React Native',
  'react-native-web': 'React Native Web',
  lynx: 'Lynx',
  'lynx-web': 'Lynx for Web',
};

/**
 * Plugins published before this feature declared nothing; they all target
 * React Native, so that's the assumed compatibility for an unlabeled plugin.
 */
export const DEFAULT_PLUGIN_INTEGRATIONS: readonly RozeniteIntegration[] = ['react-native'];

/**
 * Resolves which integration a connected target is, from the host this dev
 * server serves and the device platform CDP reports for that target.
 *
 * `targetPlatform` is `ReactNativeApplication.metadataUpdated`'s `platform`
 * field — the DEVICE OS (`ios`/`android`), or `web` for a browser target
 * (Rozenite for Web, or a Lynx card opened in a browser). It is intentionally
 * `unknown`: it comes off the wire from a device we don't control, so
 * anything other than the literal string `'web'` — including `undefined`, a
 * typo, or a future platform name — falls back to the host's native
 * integration rather than throwing.
 */
export const resolveIntegration = (
  host: RozeniteHostIntegration,
  targetPlatform: unknown,
): RozeniteIntegration => {
  const isWeb = targetPlatform === 'web';

  if (host === 'lynx') {
    return isWeb ? 'lynx-web' : 'lynx';
  }

  return isWeb ? 'react-native-web' : 'react-native';
};
