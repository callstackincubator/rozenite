import { ToolRegistry } from './tool-registry.js';
import type {
  DevToolsPluginMessage,
  RegisterToolPayload,
  UnregisterToolPayload,
  ToolCallPayload,
  ToolResultPayload,
} from './types.js';
import { MCP_PLUGIN_ID } from '@rozenite/mcp-shared';

export interface DeviceSender {
  sendMessage(message: unknown): void;
}

export class MCPMessageHandler {
  private registry: ToolRegistry = new ToolRegistry();
  private deviceConnections: Map<string, DeviceSender> = new Map();
  private pendingCalls: Map<
    string,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
      timeoutId: NodeJS.Timeout;
    }
  > = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() { }

  onToolsChanged(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyToolsChanged(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  connectDevice(
    deviceId: string,
    deviceName: string,
    sender: DeviceSender,
  ): void {
    this.registry.registerDevice(deviceId, deviceName);
    this.deviceConnections.set(deviceId, sender);
    this.notifyToolsChanged();
  }

  disconnectDevice(deviceId: string): void {
    this.registry.unregisterDevice(deviceId);
    this.deviceConnections.delete(deviceId);
    this.notifyToolsChanged();
  }

  handleDeviceMessage(deviceId: string, message: DevToolsPluginMessage): void {
    if (message.pluginId !== MCP_PLUGIN_ID) {
      return;
    }

    switch (message.type) {
      case 'register-tool': {
        const payload = message.payload as RegisterToolPayload;
        this.registry.registerTools(deviceId, payload.tools);
        this.notifyToolsChanged();
        break;
      }

      case 'unregister-tool': {
        const payload = message.payload as UnregisterToolPayload;
        this.registry.unregisterTools(deviceId, payload.toolNames);
        this.notifyToolsChanged();
        break;
      }

      case 'tool-result': {
        const payload = message.payload as ToolResultPayload;
        const pending = this.pendingCalls.get(payload.callId);

        if (pending) {
          this.pendingCalls.delete(payload.callId);
          clearTimeout(pending.timeoutId);

          if (payload.success) {
            pending.resolve(payload.result);
          } else {
            pending.reject(new Error(payload.error || 'Tool call failed'));
          }
        }
        break;
      }
    }
  }

  getTools() {
    return this.registry.getAggregatedTools();
  }

  async callTool(toolName: string, args: unknown): Promise<unknown> {
    // Extract deviceId from args if present
    let deviceId: string | undefined;
    let toolArgs = args;

    if (
      args &&
      typeof args === 'object' &&
      'deviceId' in args &&
      typeof args.deviceId === 'string'
    ) {
      deviceId = args.deviceId;
      // Remove deviceId from args before sending to device
      const { deviceId: _, ...rest } = args as Record<string, unknown>;
      toolArgs = rest;
    }

    // Find the device that has this tool
    const targetDeviceId = this.registry.findToolDevice(toolName, deviceId);

    if (!targetDeviceId) {
      throw new Error(
        `Tool "${toolName}" not found${deviceId ? ` on device "${deviceId}"` : ''}`,
      );
    }

    const sender = this.deviceConnections.get(targetDeviceId);
    if (!sender) {
      throw new Error(`Device "${targetDeviceId}" not connected`);
    }

    // Generate a unique call ID
    const callId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Send the tool call message
    const message: DevToolsPluginMessage = {
      pluginId: MCP_PLUGIN_ID,
      type: 'tool-call',
      payload: {
        callId,
        toolName,
        arguments: toolArgs,
      } as ToolCallPayload,
    };

    sender.sendMessage(message);

    // Wait for the response
    return new Promise((resolve, reject) => {
      // Timeout after 30 seconds
      const timeoutId = setTimeout(() => {
        const pending = this.pendingCalls.get(callId);
        if (pending) {
          this.pendingCalls.delete(callId);
          pending.reject(new Error('Tool call timeout'));
        }
      }, 30000);

      this.pendingCalls.set(callId, { resolve, reject, timeoutId });
    });
  }
}
