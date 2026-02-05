import type { MCPTool } from '@rozenite/mcp-shared';

export type {
  JSONSchema7,
  MCPTool,
  DevToolsPluginMessage,
  RegisterToolPayload,
  UnregisterToolPayload,
  ToolCallPayload,
  ToolResultPayload,
} from '@rozenite/mcp-shared';

export interface DeviceInfo {
  id: string;
  name: string;
}

export interface RegisteredTool {
  tool: MCPTool;
  deviceId: string;
}
