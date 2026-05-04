import type { DomainDefinition } from './types.js';

export const STATIC_DOMAINS: DomainDefinition[] = [
  {
    id: 'console',
    kind: 'static',
    description: 'CDP-style Console domain for React Native log access.',
    actions: ['list-tools', 'get-tool-schema', 'call-tool'],
  },
  {
    id: 'react',
    kind: 'static',
    description: 'React tree inspection and profiling tools.',
    actions: ['list-tools', 'get-tool-schema', 'call-tool'],
  },
  {
    id: 'performance',
    kind: 'static',
    description:
      'CDP performance tracing tools with Metro-managed artifact exports.',
    actions: ['list-tools', 'get-tool-schema', 'call-tool'],
  },
  {
    id: 'memory',
    kind: 'static',
    description:
      'CDP memory inspection and heap profiling tools with Metro-managed artifact exports.',
    actions: ['list-tools', 'get-tool-schema', 'call-tool'],
  },
  {
    id: 'network',
    kind: 'static',
    description:
      'Raw CDP network recording tools with paginated request browsing.',
    actions: ['list-tools', 'get-tool-schema', 'call-tool'],
  },
];

export const STATIC_DOMAIN_TOOL_PREFIXES: Record<string, string> = {};

export const STATIC_DOMAIN_TOOL_NAMES: Record<string, string[]> = {
  console: ['clearMessages', 'getMessages'],
  react: [
    'searchNodes',
    'getNode',
    'getChildren',
    'getProps',
    'getState',
    'getHooks',
    'startProfiling',
    'isProfilingStarted',
    'stopProfiling',
    'getRenderData',
  ],
  performance: ['startTrace', 'stopTrace'],
  memory: ['takeHeapSnapshot', 'startSampling', 'stopSampling'],
  network: [
    'startRecording',
    'stopRecording',
    'getRecordingStatus',
    'listRequests',
    'getRequestDetails',
    'getRequestBody',
    'getResponseBody',
  ],
};
