import { describe, expect, it } from 'vitest';
import { AGENT_MESSAGE_TYPES, BUILT_IN_DOMAIN_TOOL_NAMES } from '../index.js';

describe('built-in tool names', () => {
  it('keeps the published domain tool names', () => {
    expect(BUILT_IN_DOMAIN_TOOL_NAMES).toEqual({
      console: ['clearMessages', 'getMessages'],
      react: [
        'getTree',
        'searchNodes',
        'getComponent',
        'getNode',
        'getChildren',
        'getProps',
        'getState',
        'getHooks',
        'getErrors',
        'startProfiling',
        'isProfilingStarted',
        'stopProfiling',
        'getComponentRenders',
        'getProfileTimeline',
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
    });
  });
});

describe('AGENT_MESSAGE_TYPES', () => {
  it('keeps the wire strings', () => {
    expect(AGENT_MESSAGE_TYPES).toEqual({
      registerTool: 'register-tool',
      unregisterTool: 'unregister-tool',
      toolCall: 'tool-call',
      toolResult: 'tool-result',
      agentSessionReady: 'agent-session-ready',
    });
  });
});
