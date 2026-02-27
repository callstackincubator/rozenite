import type { MCPTool, RegisteredTool, DeviceInfo } from './types.js';

export type ToolRegistry = ReturnType<typeof createToolRegistry>;

export const createToolRegistry = () => {
  const tools: Map<string, Map<string, MCPTool>> = new Map();
  const devices: Map<string, DeviceInfo> = new Map();

  const registerDevice = (
    deviceId: string,
    deviceName: string,
    reactNativeVersion?: string,
  ): void => {
    devices.set(deviceId, { id: deviceId, name: deviceName, reactNativeVersion });
    if (!tools.has(deviceId)) {
      tools.set(deviceId, new Map());
    }
  };

  const unregisterDevice = (deviceId: string): void => {
    devices.delete(deviceId);
    tools.delete(deviceId);
  };

  const registerTools = (deviceId: string, incomingTools: MCPTool[]): void => {
    let deviceTools = tools.get(deviceId);
    if (!deviceTools) {
      deviceTools = new Map();
      tools.set(deviceId, deviceTools);
    }

    for (const tool of incomingTools) {
      deviceTools.set(tool.name, tool);
    }
  };

  const unregisterTools = (deviceId: string, toolNames: string[]): void => {
    const deviceTools = tools.get(deviceId);
    if (!deviceTools) {
      return;
    }

    for (const toolName of toolNames) {
      deviceTools.delete(toolName);
    }
  };

  const getDevices = (): DeviceInfo[] => {
    return Array.from(devices.values());
  };

  const hasDevice = (deviceId: string): boolean => {
    return devices.has(deviceId);
  };

  const getToolsForDevice = (deviceId: string): MCPTool[] => {
    const deviceTools = tools.get(deviceId);
    if (!deviceTools) {
      return [];
    }

    return Array.from(deviceTools.values());
  };

  const getAllRegisteredTools = (): RegisteredTool[] => {
    const allTools: RegisteredTool[] = [];

    for (const [deviceId, deviceTools] of tools.entries()) {
      for (const tool of deviceTools.values()) {
        allTools.push({ tool, deviceId });
      }
    }

    return allTools;
  };

  const getCommonToolNames = (deviceIds: string[]): string[] => {
    if (deviceIds.length === 0) {
      return [];
    }

    const firstDeviceTools = tools.get(deviceIds[0]);
    if (!firstDeviceTools || firstDeviceTools.size === 0) {
      return [];
    }

    const commonNames = new Set(firstDeviceTools.keys());

    for (const deviceId of deviceIds.slice(1)) {
      const deviceTools = tools.get(deviceId);
      if (!deviceTools || deviceTools.size === 0) {
        return [];
      }

      for (const name of Array.from(commonNames)) {
        if (!deviceTools.has(name)) {
          commonNames.delete(name);
        }
      }
    }

    return Array.from(commonNames);
  };

  const getAggregatedTools = (): MCPTool[] => {
    const availableDevices = getDevices();
    if (availableDevices.length === 0) {
      return [];
    }

    const commonToolNames = getCommonToolNames(
      availableDevices.map((device) => device.id),
    );
    const toolsByName = new Map<string, RegisteredTool[]>();

    for (const toolName of commonToolNames) {
      const registeredTools: RegisteredTool[] = [];
      for (const device of availableDevices) {
        const tool = tools.get(device.id)?.get(toolName);
        if (tool) {
          registeredTools.push({ tool, deviceId: device.id });
        }
      }

      if (registeredTools.length === availableDevices.length) {
        toolsByName.set(toolName, registeredTools);
      }
    }

    const aggregatedTools: MCPTool[] = [];

    for (const [toolName, registeredTools] of toolsByName.entries()) {
      const firstTool = registeredTools[0].tool;

      if (availableDevices.length <= 1 || registeredTools.length === 1) {
        aggregatedTools.push(firstTool);
        continue;
      }

      const deviceIds = registeredTools.map((rt) => rt.deviceId);
      const deviceNames = deviceIds
        .map((id) => devices.get(id)?.name || id)
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
        required: ['deviceId', ...(firstTool.inputSchema.required || [])],
      };

      aggregatedTools.push({
        name: toolName,
        description: firstTool.description,
        inputSchema: modifiedSchema,
      });
    }

    return aggregatedTools;
  };

  const findToolDevice = (toolName: string, deviceId?: string): string | null => {
    if (deviceId) {
      const deviceTools = tools.get(deviceId);
      if (deviceTools && deviceTools.has(toolName)) {
        return deviceId;
      }
      return null;
    }

    for (const [devId, deviceTools] of tools.entries()) {
      if (deviceTools.has(toolName)) {
        return devId;
      }
    }

    return null;
  };

  return {
    registerDevice,
    unregisterDevice,
    registerTools,
    unregisterTools,
    getDevices,
    hasDevice,
    getToolsForDevice,
    getAllRegisteredTools,
    getAggregatedTools,
    findToolDevice,
  };
};
