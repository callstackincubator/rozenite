import type { FeatureFlag, FeatureFlagValue } from './types';

export const FEATURE_FLAGS_PLUGIN_ID = '@rozenite/feature-flags-plugin';

export type FeatureFlagsProviderSnapshot = {
  id: string;
  name: string;
  flags: FeatureFlag[];
};

export type FeatureFlagsSnapshot = {
  providers: FeatureFlagsProviderSnapshot[];
};

/**
 * RPC methods exposed by the device peer, called by the panel via
 * `createRozeniteRpc`. See `website/src/docs/plugin-development/rpc.md`.
 */
export type FeatureFlagsMethods = {
  getSnapshot: () => Promise<FeatureFlagsSnapshot>;
  setOverride: (params: {
    providerId?: string;
    key: string;
    value: FeatureFlagValue;
  }) => Promise<{ flag: FeatureFlag }>;
  clearOverride: (params: { providerId?: string; key: string }) => Promise<{ flag: FeatureFlag }>;
  clearAllOverrides: (params: { providerId?: string }) => Promise<{ cleared: number }>;
  refresh: (params: { providerId?: string }) => Promise<void>;
};

/**
 * The one device -> panel event: an unsolicited push telling the panel a
 * provider's flags changed (remote update, refresh, or an override set from
 * the app side). The panel reacts by refetching the snapshot via RPC.
 *
 * Note: `'rozenite:rpc'` is reserved by the RPC layer and must never be used
 * as an event type here.
 */
export type FeatureFlagsChangedEvent = {
  type: 'flags-changed';
  providerId: string;
};

export type FeatureFlagsEvent = FeatureFlagsChangedEvent;

export type FeatureFlagsEventMap = {
  [K in FeatureFlagsEvent['type']]: Extract<FeatureFlagsEvent, { type: K }>;
};
