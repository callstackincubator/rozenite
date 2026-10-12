import { describe, expect, it } from 'vitest';
import { isAgentToolRows } from '@rozenite/agent-shared';
import { featureFlagsToolDefinitions } from '../shared/agent-tools';

describe('feature flags agent tools', () => {
  it('declares list-flags rows: one per provider, flags nested', () => {
    const { rows } = featureFlagsToolDefinitions.listFlags;
    expect(rows).toEqual({ key: 'providers', fields: ['providerId', 'providerName', 'flags'] });
    expect(isAgentToolRows(rows)).toBe(true);
  });
});
