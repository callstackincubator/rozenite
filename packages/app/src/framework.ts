import type { RozenitePlatform } from './config';

/**
 * The frameworks this app can be pointed at. Rozenite for Web is debugged
 * in React Native DevTools rather than here, so it never appears — but the
 * mapping below still handles it, since it costs nothing and the reader is
 * the same shape as `@rozenite/runtime`'s `framework-title.ts` (keep the
 * two in sync).
 */
export type Framework = 'React Native' | 'Web' | 'Lynx';

/**
 * Framework names as they appear in `ReactNativeApplication`'s
 * `integrationName`.
 *
 * That field is free-form — React Native's own values are host
 * integrations like "iOS Bridge (RCTBridge)" — so this recognises the
 * values Rozenite itself sends and lets everything else fall through to
 * the `platform` reading below. `Lynx` is written by
 * `@rozenite/lynx-dev`'s bridge, which answers the whole
 * `ReactNativeApplication` domain on a Lynx app's behalf.
 */
const FRAMEWORK_BY_INTEGRATION: Record<string, Framework> = {
  Lynx: 'Lynx',
};

type ApplicationMetadata = {
  integrationName?: unknown;
  platform?: unknown;
};

/**
 * The framework a connected target belongs to, from its
 * `ReactNativeApplication.metadataUpdated` payload.
 *
 * Two readings, in precedence order: an explicit `integrationName` this
 * build knows, then `platform === 'web'` (what
 * `@rozenite/chrome-extension` reports, and the only framework that *is*
 * a platform). Anything else is React Native — `platform` is the device
 * OS there (`ios`/`android`), so a new OS must not cost the label.
 */
export const getFrameworkFromMetadata = (metadata: ApplicationMetadata): Framework => {
  if (typeof metadata.integrationName === 'string') {
    const known = FRAMEWORK_BY_INTEGRATION[metadata.integrationName];

    if (known) {
      return known;
    }
  }

  return metadata.platform === 'web' ? 'Web' : 'React Native';
};

/**
 * How each host platform the dev server can report is named in the UI.
 *
 * Only the two the standalone app can be launched for: `rozenite open`
 * (React Native, via Metro) and `@rozenite/lynx-dev`'s printed URL (Lynx).
 */
const FRAMEWORK_BY_PLATFORM: Record<RozenitePlatform, Framework> = {
  'react-native': 'React Native',
  lynx: 'Lynx',
};

/**
 * The framework the *dev server* serves, from `/rozenite/app/config`.
 *
 * A coarser answer than the metadata above — it describes the server, not
 * the target — but it is available before a device connects, which is what
 * makes the footer readable while connecting. Returns `null` when the
 * server named a platform this build doesn't know: `fetchConfig` does no
 * validation, so an unknown value is dropped rather than shown raw.
 */
export const getFrameworkFromPlatform = (
  platform: RozenitePlatform | undefined,
): Framework | null => (platform ? (FRAMEWORK_BY_PLATFORM[platform] ?? null) : null);
