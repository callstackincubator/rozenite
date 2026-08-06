import { AGENT_PLUGIN_ID } from '@rozenite/agent-shared';
import { describe, expect, it } from 'vitest';
import { createAgentMessageHandler } from '../agent/runtime/handler.js';

describe('agent runtime handler console domain', () => {
  it('exposes only always-on console tools for the connected session', () => {
    const handler = createAgentMessageHandler();

    handler.connectDevice('device-1', 'iPhone 16', {
      sendMessage() {},
    });

    const tools = handler.getTools('device-1');
    const toolNames = tools.map((tool) => tool.name);

    expect(toolNames).toContain('getMessages');
    expect(toolNames).toContain('clearMessages');
    expect(toolNames).not.toContain('enable');
    expect(toolNames).not.toContain('disable');
    expect(tools.find((tool) => tool.name === 'getMessages')).toMatchObject({
      readOnly: true,
      destructive: false,
      idempotent: true,
    });
    expect(tools.find((tool) => tool.name === 'clearMessages')).toMatchObject({
      readOnly: false,
      destructive: true,
      idempotent: true,
    });
    expect(tools.find((tool) => tool.name === 'getMessages')?.pagination).toEqual({
      kind: 'cursor',
      fields: ['seq', 'timestamp', 'level', 'source', 'text', 'argsPreview', 'context'],
      defaultFields: ['seq', 'timestamp', 'level', 'source', 'text'],
    });
  });

  it('captures console messages without an explicit enable step', async () => {
    const handler = createAgentMessageHandler();

    handler.connectDevice('device-1', 'iPhone 16', {
      sendMessage() {},
    });

    handler.captureConsoleMessage('device-1', {
      level: 'info',
      text: 'hello world',
      source: 'console',
      timestamp: Date.now(),
    });

    const result = (await handler.callTool('getMessages', {})) as {
      items: Array<{ text: string }>;
      meta: { bufferSize: number };
    };

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.text).toBe('hello world');
    expect(result.meta.bufferSize).toBe(1);
  });

  it('preserves plugin-declared traits through registration and session discovery', () => {
    const handler = createAgentMessageHandler();
    handler.connectDevice('device-1', 'iPhone 16', { sendMessage() {} });

    handler.handleDeviceMessage('device-1', {
      pluginId: AGENT_PLUGIN_ID,
      type: 'register-tool',
      payload: {
        tools: [
          {
            name: 'example.reset',
            description: 'Reset the example state.',
            readOnly: false,
            destructive: true,
            idempotent: true,
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      },
    });

    expect(handler.getTools('device-1')).toContainEqual(
      expect.objectContaining({
        name: 'example.reset',
        readOnly: false,
        destructive: true,
        idempotent: true,
      }),
    );
  });
});
