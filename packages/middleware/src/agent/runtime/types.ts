import type {
  AgentTool,
  DevToolsPluginMessage,
  JSONSchema7,
  RegisterToolPayload,
  ToolCallPayload,
  ToolResultPayload,
  UnregisterToolPayload,
} from '@rozenite/agent-shared';

export type {
  AgentTool,
  DevToolsPluginMessage,
  JSONSchema7,
  RegisterToolPayload,
  UnregisterToolPayload,
  ToolCallPayload,
  ToolResultPayload,
};

export interface DeviceInfo {
  id: string;
  name: string;
  reactNativeVersion?: string;
}

export interface RegisteredTool {
  tool: AgentTool;
  deviceId: string;
}
