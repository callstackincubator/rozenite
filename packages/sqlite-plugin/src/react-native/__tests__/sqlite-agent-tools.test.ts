import { describe, expect, it, vi } from 'vitest';

vi.mock('@rozenite/agent-bridge', () => ({
  useRozenitePluginAgentTool: vi.fn(),
}));

import { listDatabasesTool } from '../useSqliteAgentTools';

describe('sqlite agent tools', () => {
  it('declares list-databases rows so the CLI prints them as columns', () => {
    expect(listDatabasesTool.rows).toEqual({
      key: 'databases',
      fields: ['id', 'name', 'adapterId', 'adapterName'],
      defaultFields: ['id', 'name', 'adapterName'],
    });
  });
});
