export type {
  JSONSchema7,
  AgentTool,
  MetroTarget,
} from '@rozenite/agent-shared';

export interface DomainDefinition {
  id: string;
  kind: 'static' | 'plugin';
  description: string;
  pluginId?: string;
  slug?: string;
  actions: Array<'list-tools' | 'get-tool-schema' | 'call-tool'>;
}
