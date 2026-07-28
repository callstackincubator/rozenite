import type { AgentTool } from '@rozenite/agent-shared';

export { AGENT_PLUGIN_ID } from '@rozenite/agent-shared';

export type {
  AgentTool,
  DevToolsPluginMessage,
  JSONSchema7,
  RegisterToolPayload,
  UnregisterToolPayload,
  ToolCallPayload,
  ToolResultPayload,
} from '@rozenite/agent-shared';

export interface DeviceInfo {
  id: string;
  name: string;
  reactNativeVersion?: string;
}

export interface RegisteredTool {
  tool: AgentTool;
  deviceId: string;
}
