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
 * `ReactNativeApplication.metadataUpdated` payload — the only source for
 * it. The dev server is not asked: it knows which platform *it* serves,
 * but that describes the server rather than the target, so the label
 * appears once the handshake has produced this event and not before.
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
