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

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: JSONSchema7;
}

export interface MetroTarget {
  id: string;
  name: string;
  reactNativeVersion?: string;
  app?: string;
  platform?: string;
  runtime?: string;
  type?: string;
  description?: string;
}

export interface DomainDefinition {
  id: string;
  kind: 'static' | 'plugin';
  description: string;
  pluginId?: string;
  slug?: string;
  actions: Array<'list-tools' | 'get-tool-schema' | 'call-tool'>;
}
