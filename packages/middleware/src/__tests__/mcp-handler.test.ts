import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMCPMessageHandler } from '../mcp/handler.js';
import { MCP_PLUGIN_ID, type DevToolsPluginMessage, type MCPTool } from '../mcp/types.js';

const createTool = (name: string): MCPTool => ({
  name,
  description: `${name} description`,
  inputSchema: { type: 'object', properties: {} },
});

const registerToolsMessage = (tools: MCPTool[]): DevToolsPluginMessage => ({
  pluginId: MCP_PLUGIN_ID,
  type: 'register-tool',
  payload: { tools },
});

describe('MCPMessageHandler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses connected device sender when available', async () => {
    const handler = createMCPMessageHandler();
    const sendMessage = vi.fn();

    handler.connectDevice('device-1', 'Device 1', { sendMessage });
    handler.handleDeviceMessage(
      'device-1',
      registerToolsMessage([createTool('app.list-entries')]),
    );

    const resultPromise = handler.callTool('app.list-entries', { key: 'foo' });

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(1);
    });
    const sentPayload = sendMessage.mock.calls[0][0] as DevToolsPluginMessage;
    const callId = (sentPayload.payload as { callId: string }).callId;

    handler.handleDeviceMessage('device-1', {
      pluginId: MCP_PLUGIN_ID,
      type: 'tool-result',
      payload: {
        callId,
        success: true,
        result: { ok: true },
      },
    });

    await expect(resultPromise).resolves.toEqual({ ok: true });
  });

  it('keeps tool-not-found error behavior', async () => {
    const handler = createMCPMessageHandler();

    await expect(handler.callTool('app.unknown', {})).rejects.toThrow(
      'Tool "app.unknown" not found',
    );
  });

  it('throws a readable error when no active connection exists for a known tool', async () => {
    const handler = createMCPMessageHandler();
    const sendMessage = vi.fn();

    handler.connectDevice('device-2', 'Device 2', { sendMessage });
    handler.handleDeviceMessage(
      'device-2',
      registerToolsMessage([createTool('app.read-entry')]),
    );
    handler.disconnectDevice('device-2');
    handler.handleDeviceMessage(
      'device-2',
      registerToolsMessage([createTool('app.read-entry')]),
    );

    await expect(handler.callTool('app.read-entry', {})).rejects.toThrow(
      'there is no active DevTools connection',
    );
  });
});
