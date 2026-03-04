import type { DomainDefinition } from './types.js';

export const DEFAULT_METRO_HOST = 'localhost';
export const DEFAULT_METRO_PORT = 8081;

export const STATIC_DOMAINS: DomainDefinition[] = [
  {
    id: 'console',
    kind: 'static',
    description: 'CDP-style Console domain for React Native log access.',
    actions: ['list-tools', 'get-tool-schema', 'call-tool'],
  },
];

export const STATIC_DOMAIN_TOOL_PREFIXES: Record<string, string> = {
  console: 'Console.',
};
