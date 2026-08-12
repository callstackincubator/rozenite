import { defineAgentToolContract, type AgentToolContract } from '@rozenite/agent-shared';

import type { FeatureFlag, FeatureFlagType, FeatureFlagValue } from './types';

const providerIdProperty = {
  type: 'string',
  description: 'Provider ID. Required only when multiple providers are registered.',
} as const;

export const FEATURE_FLAGS_AGENT_PLUGIN_ID = '@rozenite/feature-flags-plugin';

export const FEATURE_FLAG_TYPES = [
  'boolean',
  'string',
  'number',
  'json',
] as const satisfies readonly FeatureFlagType[];

export type FeatureFlagsListFlagsArgs = {
  providerId?: string;
};

export type FeatureFlagsListFlagsProvider = {
  providerId: string;
  providerName: string;
  flags: FeatureFlag[];
};

export type FeatureFlagsListFlagsResult = {
  providers: FeatureFlagsListFlagsProvider[];
};

export type FeatureFlagsGetFlagArgs = {
  providerId?: string;
  key: string;
};

export type FeatureFlagsGetFlagResult = {
  providerId: string;
  flag: FeatureFlag;
};

export type FeatureFlagsOverrideFlagArgs = {
  providerId?: string;
  key: string;
  value: FeatureFlagValue;
};

export type FeatureFlagsOverrideFlagResult = {
  providerId: string;
  flag: FeatureFlag;
};

export type FeatureFlagsClearOverridesArgs = {
  providerId?: string;
  key?: string;
};

export type FeatureFlagsClearOverridesResult = {
  providerId: string;
  cleared: number;
  flag?: FeatureFlag;
};

export const featureFlagsToolDefinitions = {
  listFlags: defineAgentToolContract<FeatureFlagsListFlagsArgs, FeatureFlagsListFlagsResult>({
    name: 'list-flags',
    description:
      'List feature flags across providers, including their type, effective value, and whether they are currently overridden. Flag counts are small (tens to low hundreds), so results are not paginated. Omit providerId to list flags for every registered provider.',
    inputSchema: {
      type: 'object',
      properties: {
        providerId: providerIdProperty,
      },
    },
  }),
  getFlag: defineAgentToolContract<FeatureFlagsGetFlagArgs, FeatureFlagsGetFlagResult>({
    name: 'get-flag',
    description:
      'Read a single feature flag by key, including its effective (post-override) value.',
    inputSchema: {
      type: 'object',
      properties: {
        providerId: providerIdProperty,
        key: { type: 'string', description: 'Flag key.' },
      },
      required: ['key'],
    },
  }),
  overrideFlag: defineAgentToolContract<
    FeatureFlagsOverrideFlagArgs,
    FeatureFlagsOverrideFlagResult
  >({
    name: 'override-flag',
    description:
      'Force a feature flag to a specific value on this device, useful for reproducing a bug report that only occurs when a flag is on (or off, or set to a particular variant). The override persists until cleared with clear-overrides. `value` must match the flag\'s declared type (see get-flag/list-flags): a JSON boolean for type "boolean", a JSON string for type "string", a JSON number for type "number", or any JSON-serializable value (object, array, string, number, boolean, or null) for type "json".',
    inputSchema: {
      type: 'object',
      properties: {
        providerId: providerIdProperty,
        key: { type: 'string', description: 'Flag key.' },
        value: {
          description:
            'New value for the flag, matching its declared type: boolean for "boolean", string for "string", number for "number", or any JSON value for "json".',
        },
      },
      required: ['key', 'value'],
    },
  }),
  clearOverrides: defineAgentToolContract<
    FeatureFlagsClearOverridesArgs,
    FeatureFlagsClearOverridesResult
  >({
    name: 'clear-overrides',
    description:
      "Clear feature flag overrides for a provider. Pass `key` to clear a single flag's override (the resulting flag is returned); omit `key` to clear every override for the provider (the count of cleared flags is returned).",
    inputSchema: {
      type: 'object',
      properties: {
        providerId: providerIdProperty,
        key: {
          type: 'string',
          description: 'Flag key to clear. Omit to clear every override for the provider.',
        },
      },
    },
  }),
} as const satisfies Record<string, AgentToolContract<unknown, unknown>>;
