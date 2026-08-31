/**
 * The frameworks this app can be pointed at.
 */
export type Framework = 'React Native' | 'Web' | 'Lynx';

/**
 * Framework names as they appear in `ReactNativeApplication`'s
 * `integrationName`.
 *
 * That field is free-form — React Native's own values are host
 * integrations like "iOS Bridge (RCTBridge)" — so this recognises the
 * values Rozenite itself sends and lets everything else fall through to
 * the readings below. `Lynx` is written by `@rozenite/lynx-dev`'s bridge,
 * which answers the whole `ReactNativeApplication` domain on a Lynx app's
 * behalf, and is the only way to tell Lynx apart per target: `platform` is
 * the device OS there, and Lynx is invisible to the device probe (its
 * `lynx` binding lives in module scope, not on `globalThis`).
 */
const FRAMEWORK_BY_INTEGRATION: Record<string, Framework> = {
  Lynx: 'Lynx',
};

export type FrameworkSignals = {
  /** `integrationName` from `ReactNativeApplication.metadataUpdated`. */
  integrationName?: unknown;
  /** `platform` from the same event. Only a fallback — see below. */
  platform?: unknown;
  /**
   * What the device answered when asked whether it is a browser, or `null`
   * while that is still unknown. See `IS_WEB_TARGET_EXPRESSION`.
   */
  isWebTarget: boolean | null;
};

/**
 * The framework a connected target belongs to.
 *
 * Readings in precedence order:
 *
 * 1. An `integrationName` this build knows — currently only Lynx, which
 *    nothing else can identify.
 * 2. What the device itself said when asked. This is the same signal that
 *    decides a target's `RozeniteIntegration`, and the reason both come
 *    from one function: a label and a compatibility gate that disagree
 *    about whether the target is a browser would be worse than either
 *    being late.
 * 3. `platform === 'web'` from the metadata event — what
 *    `@rozenite/chrome-extension` reports. DISPLAY ONLY, and reached only
 *    when the probe could not answer, so the label still appears. It is
 *    deliberately not used to resolve an integration: the event is
 *    unordered against anything a host does, so reading it early reports a
 *    browser target as native, indistinguishably from a real answer.
 *
 * Anything else is React Native — `platform` is the device OS there
 * (`ios`/`android`), so a new OS must not cost the label.
 */
export const resolveFramework = ({
  integrationName,
  platform,
  isWebTarget,
}: FrameworkSignals): Framework => {
  if (typeof integrationName === 'string') {
    const known = FRAMEWORK_BY_INTEGRATION[integrationName];

    if (known) {
      return known;
    }
  }

  if (isWebTarget !== null) {
    return isWebTarget ? 'Web' : 'React Native';
  }

  return platform === 'web' ? 'Web' : 'React Native';
};
