import { describe, expect, it } from 'vitest';
import { createToolRegistry } from '../agent/runtime/tool-registry.js';

describe('agent tool registry', () => {
  it('preserves pagination metadata when aggregating multiple devices', () => {
    const registry = createToolRegistry();
    const tool = {
      name: 'plugin.list',
      description: 'List rows',
      inputSchema: { type: 'object' as const, properties: {} },
      pagination: {
        kind: 'cursor' as const,
        fields: ['id', 'label'],
      },
    };

    registry.registerDevice('device-1', 'iPhone');
    registry.registerDevice('device-2', 'Android');
    registry.registerTools('device-1', [tool]);
    registry.registerTools('device-2', [tool]);

    expect(registry.getAggregatedTools()).toEqual([
      expect.objectContaining({
        name: 'plugin.list',
        pagination: tool.pagination,
        inputSchema: expect.objectContaining({
          required: ['deviceId'],
        }),
      }),
    ]);
  });
});
