import { describe, expect, it } from 'vitest';
import type { AgentTool } from '@rozenite/agent-shared';
import { toAgentToolSchema } from '../domain-utils.js';

describe('toAgentToolSchema rows', () => {
  it('passes the rows declaration through', () => {
    const tool: AgentTool = {
      name: '@rozenite/storage-plugin.list-storages',
      description: 'List storages',
      inputSchema: { type: 'object', properties: {} },
      rows: { key: 'storages', fields: ['id', 'name'], defaultFields: ['id'] },
    };

    expect(toAgentToolSchema(tool).rows).toEqual(tool.rows);
  });
});
