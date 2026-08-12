import { isValueOfType, type FeatureFlag, type FeatureFlagsProvider } from '../shared/types';

const findFlagOrThrow = (
  flags: FeatureFlag[],
  key: string,
  provider: FeatureFlagsProvider,
): FeatureFlag => {
  const flag = flags.find((candidate) => candidate.key === key);

  if (!flag) {
    throw new Error(
      `[Rozenite] Feature Flags Plugin: flag "${key}" not found on provider "${provider.id}".`,
    );
  }

  return flag;
};

/**
 * Validates `value` against the flag's declared type before writing it, and
 * returns the provider's flags after the write. Shared by the RPC
 * `setOverride` handler (`handlers.ts`) and the `override-flag` agent tool
 * (`useFeatureFlagsAgentTools.ts`) so a wrong-typed value from either path is
 * rejected up front instead of being committed and then rendered under the
 * declared type.
 */
export const setValidatedOverride = async (
  provider: FeatureFlagsProvider,
  key: string,
  value: unknown,
): Promise<FeatureFlag[]> => {
  const flags = await provider.listFlags();
  const existing = findFlagOrThrow(flags, key, provider);

  if (!isValueOfType(existing.type, value)) {
    throw new Error(
      `[Rozenite] Feature Flags Plugin: value does not match the declared type "${existing.type}" for flag "${key}" on provider "${provider.id}".`,
    );
  }

  await provider.setOverride(key, value);
  return provider.listFlags();
};
