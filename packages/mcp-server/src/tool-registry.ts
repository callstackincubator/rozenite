import type { MCPTool, RegisteredTool, DeviceInfo } from './types.js';

export class ToolRegistry {
  private tools: Map<string, Map<string, MCPTool>> = new Map();
  private devices: Map<string, DeviceInfo> = new Map();

  registerDevice(deviceId: string, deviceName: string): void {
    this.devices.set(deviceId, { id: deviceId, name: deviceName });
    if (!this.tools.has(deviceId)) {
      this.tools.set(deviceId, new Map());
    }
  }

  unregisterDevice(deviceId: string): void {
    this.devices.delete(deviceId);
    this.tools.delete(deviceId);
  }

  registerTools(deviceId: string, tools: MCPTool[]): void {
    let deviceTools = this.tools.get(deviceId);
    if (!deviceTools) {
      deviceTools = new Map();
      this.tools.set(deviceId, deviceTools);
    }

    for (const tool of tools) {
      deviceTools.set(tool.name, tool);
    }
  }

  unregisterTools(deviceId: string, toolNames: string[]): void {
    const deviceTools = this.tools.get(deviceId);
    if (!deviceTools) {
      return;
    }

    for (const toolName of toolNames) {
      deviceTools.delete(toolName);
    }
  }

  getDevices(): DeviceInfo[] {
    return Array.from(this.devices.values());
  }

  getToolsForDevice(deviceId: string): MCPTool[] {
    const deviceTools = this.tools.get(deviceId);
    if (!deviceTools) {
      return [];
    }
    return Array.from(deviceTools.values());
  }

  getAllRegisteredTools(): RegisteredTool[] {
    const allTools: RegisteredTool[] = [];

    for (const [deviceId, deviceTools] of this.tools.entries()) {
      for (const tool of deviceTools.values()) {
        allTools.push({ tool, deviceId });
      }
    }

    return allTools;
  }

  getAggregatedTools(): MCPTool[] {
    const devices = this.getDevices();
    const allRegisteredTools = this.getAllRegisteredTools();

    // Group tools by name
    const toolsByName = new Map<string, RegisteredTool[]>();
    for (const registeredTool of allRegisteredTools) {
      const existing = toolsByName.get(registeredTool.tool.name) || [];
      existing.push(registeredTool);
      toolsByName.set(registeredTool.tool.name, existing);
    }

    const aggregatedTools: MCPTool[] = [];

    for (const [toolName, registeredTools] of toolsByName.entries()) {
      const firstTool = registeredTools[0].tool;

      // If only one device or only one device has this tool, no need for deviceId parameter
      if (devices.length <= 1 || registeredTools.length === 1) {
        aggregatedTools.push(firstTool);
      } else {
        // Multiple devices have this tool - add deviceId parameter
        const deviceIds = registeredTools.map((rt) => rt.deviceId);
        const deviceNames = deviceIds
          .map((id) => this.devices.get(id)?.name || id)
          .join(', ');

        const modifiedSchema: typeof firstTool.inputSchema = {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: `Target device ID. Available devices: ${deviceNames}`,
              enum: deviceIds,
            },
            ...(firstTool.inputSchema.properties || {}),
          },
          required: [
            'deviceId',
            ...(firstTool.inputSchema.required || []),
          ],
        };

        aggregatedTools.push({
          name: toolName,
          description: firstTool.description,
          inputSchema: modifiedSchema,
        });
      }
    }

    return aggregatedTools;
  }

  findToolDevice(toolName: string, deviceId?: string): string | null {
    // If deviceId is provided, use it
    if (deviceId) {
      const deviceTools = this.tools.get(deviceId);
      if (deviceTools && deviceTools.has(toolName)) {
        return deviceId;
      }
      return null;
    }

    // Otherwise, find the first device that has this tool
    for (const [devId, deviceTools] of this.tools.entries()) {
      if (deviceTools.has(toolName)) {
        return devId;
      }
    }

    return null;
  }
}
