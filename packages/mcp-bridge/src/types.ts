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

export type RegisterToolMessage = {
  type: 'register-tool';
  payload: {
    tools: MCPTool[];
  };
};

export type UnregisterToolMessage = {
  type: 'unregister-tool';
  payload: {
    toolNames: string[];
  };
};

export type ToolCallMessage = {
  type: 'tool-call';
  payload: {
    callId: string;
    toolName: string;
    arguments: unknown;
  };
};

export type ToolResultMessage = {
  type: 'tool-result';
  payload: {
    callId: string;
    success: boolean;
    result?: unknown;
    error?: string;
  };
};

export type MCPMessage =
  | RegisterToolMessage
  | UnregisterToolMessage
  | ToolCallMessage
  | ToolResultMessage;
