import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import { FEATURE_FLAGS_AGENT_PLUGIN_ID, featureFlagsToolDefinitions } from '../shared/agent-tools';
import { isValueOfType, type FeatureFlag, type FeatureFlagsProvider } from '../shared/types';
import { resolveProvider } from './provider-registry';

const findFlag = (flags: FeatureFlag[], key: string, providerId: string): FeatureFlag => {
  const flag = flags.find((candidate) => candidate.key === key);

  if (!flag) {
    throw new Error(
      `[Rozenite] Feature Flags Plugin: flag "${key}" not found on provider "${providerId}".`,
    );
  }

  return flag;
};

/**
 * The agent tool handler bodies, extracted from the hook so they can be
 * exercised directly against real providers (e.g. `createCustomFlagsAdapter`)
 * without mocking `useRozenitePluginAgentTool`. Delegates all provider
 * resolution and override semantics to `resolveProvider` /
 * `FeatureFlagsProvider`, matching `createFeatureFlagsHandlers`.
 */
export const createFeatureFlagsAgentToolHandlers = (providers: FeatureFlagsProvider[]) => ({
  listFlags: async ({ providerId }: { providerId?: string }) => {
    const targets = providerId === undefined ? providers : [resolveProvider(providers, providerId)];

    const providerFlags = await Promise.all(
      targets.map(async (provider) => ({
        providerId: provider.id,
        providerName: provider.name,
        flags: await provider.listFlags(),
      })),
    );

    return { providers: providerFlags };
  },

  getFlag: async ({ providerId, key }: { providerId?: string; key: string }) => {
    const provider = resolveProvider(providers, providerId);
    const flags = await provider.listFlags();
    const flag = findFlag(flags, key, provider.id);

    return { providerId: provider.id, flag };
  },

  overrideFlag: async ({
    providerId,
    key,
    value,
  }: {
    providerId?: string;
    key: string;
    value: unknown;
  }) => {
    const provider = resolveProvider(providers, providerId);
    const flags = await provider.listFlags();
    const existing = findFlag(flags, key, provider.id);

    if (!isValueOfType(existing.type, value)) {
      throw new Error(
        `[Rozenite] Feature Flags Plugin: value does not match the declared type "${existing.type}" for flag "${key}" on provider "${provider.id}".`,
      );
    }

    await provider.setOverride(key, value);
    const updatedFlags = await provider.listFlags();

    return { providerId: provider.id, flag: findFlag(updatedFlags, key, provider.id) };
  },

  clearOverrides: async ({ providerId, key }: { providerId?: string; key?: string }) => {
    const provider = resolveProvider(providers, providerId);

    if (key !== undefined) {
      const flags = await provider.listFlags();
      const existing = findFlag(flags, key, provider.id);
      const wasOverridden = existing.overridden;

      await provider.clearOverride(key);
      const updatedFlags = await provider.listFlags();

      return {
        providerId: provider.id,
        cleared: wasOverridden ? 1 : 0,
        flag: findFlag(updatedFlags, key, provider.id),
      };
    }

    const flags = await provider.listFlags();
    const cleared = flags.filter((flag) => flag.overridden).length;
    await provider.clearAllOverrides();

    return { providerId: provider.id, cleared };
  },
});

export const useFeatureFlagsAgentTools = (providers: FeatureFlagsProvider[]) => {
  const handlers = createFeatureFlagsAgentToolHandlers(providers);

  useRozenitePluginAgentTool({
    pluginId: FEATURE_FLAGS_AGENT_PLUGIN_ID,
    tool: featureFlagsToolDefinitions.listFlags,
    handler: handlers.listFlags,
  });

  useRozenitePluginAgentTool({
    pluginId: FEATURE_FLAGS_AGENT_PLUGIN_ID,
    tool: featureFlagsToolDefinitions.getFlag,
    handler: handlers.getFlag,
  });

  useRozenitePluginAgentTool({
    pluginId: FEATURE_FLAGS_AGENT_PLUGIN_ID,
    tool: featureFlagsToolDefinitions.overrideFlag,
    handler: handlers.overrideFlag,
  });

  useRozenitePluginAgentTool({
    pluginId: FEATURE_FLAGS_AGENT_PLUGIN_ID,
    tool: featureFlagsToolDefinitions.clearOverrides,
    handler: handlers.clearOverrides,
  });
};
