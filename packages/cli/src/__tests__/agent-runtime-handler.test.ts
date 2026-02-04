import { describe, expect, it } from 'vitest';
import { createAgentMessageHandler } from '../commands/agent/runtime/handler.js';

describe('agent runtime handler console domain', () => {
  it('exposes only always-on console tools', () => {
    const handler = createAgentMessageHandler();

    handler.connectDevice('device-1', 'iPhone 16', {
      sendMessage() {},
    });

    const toolNames = handler.getTools().map((tool) => tool.name);

    expect(toolNames).toContain('getMessages');
    expect(toolNames).toContain('clearMessages');
    expect(toolNames).not.toContain('enable');
    expect(toolNames).not.toContain('disable');
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

    const result = await handler.callTool('getMessages', {}) as {
      items: Array<{ text: string }>;
      meta: { bufferSize: number };
    };

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.text).toBe('hello world');
    expect(result.meta.bufferSize).toBe(1);
  });
});
