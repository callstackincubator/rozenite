export const MCP_PLUGIN_ID = 'rozenite-mcp';

export interface JSONSchema7 {
  type?: string | string[];
  properties?: Record<string, JSONSchema7>;
  items?: JSONSchema7 | JSONSchema7[];
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  description?: string;
  title?: string;
  default?: unknown;
  examples?: unknown[];
  [key: string]: unknown;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema7;
}

export type DevToolsPluginMessage = {
  pluginId: string;
  type: string;
  payload: unknown;
};

export type RegisterToolPayload = {
  tools: MCPTool[];
};

export type UnregisterToolPayload = {
  toolNames: string[];
};

export type ToolCallPayload = {
  callId: string;
  toolName: string;
  arguments: unknown;
};

export type ToolResultPayload = {
  callId: string;
  success: boolean;
  result?: unknown;
  error?: string;
};

export type RegisterToolMessage = {
  type: 'register-tool';
  payload: RegisterToolPayload;
};

export type UnregisterToolMessage = {
  type: 'unregister-tool';
  payload: UnregisterToolPayload;
};

export type ToolCallMessage = {
  type: 'tool-call';
  payload: ToolCallPayload;
};

export type ToolResultMessage = {
  type: 'tool-result';
  payload: ToolResultPayload;
};

export type MCPMessage =
  | RegisterToolMessage
  | UnregisterToolMessage
  | ToolCallMessage
  | ToolResultMessage;
