import { defineAgentToolDescriptors } from '@rozenite/agent-shared';
import {
  FEATURE_FLAG_TYPES,
  FEATURE_FLAGS_AGENT_PLUGIN_ID,
  featureFlagsToolDefinitions,
} from './src/shared/agent-tools.js';

export { FEATURE_FLAG_TYPES, FEATURE_FLAGS_AGENT_PLUGIN_ID, featureFlagsToolDefinitions };

export const featureFlagsTools = defineAgentToolDescriptors(
  FEATURE_FLAGS_AGENT_PLUGIN_ID,
  featureFlagsToolDefinitions,
);

export type {
  FeatureFlagsClearOverridesArgs,
  FeatureFlagsClearOverridesResult,
  FeatureFlagsGetFlagArgs,
  FeatureFlagsGetFlagResult,
  FeatureFlagsListFlagsArgs,
  FeatureFlagsListFlagsProvider,
  FeatureFlagsListFlagsResult,
  FeatureFlagsOverrideFlagArgs,
  FeatureFlagsOverrideFlagResult,
} from './src/shared/agent-tools.js';

export type {
  FeatureFlag,
  FeatureFlagsProvider,
  FeatureFlagType,
  FeatureFlagValue,
} from './src/shared/types';

export type { FeatureFlagsProviderSnapshot, FeatureFlagsSnapshot } from './src/shared/messaging';
