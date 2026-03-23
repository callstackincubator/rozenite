import type { AgentTool } from '@rozenite/agent-bridge';

export const startRecordingTool: AgentTool = {
  name: 'startRecording',
  description:
    'Start recording network activity in the fallback network activity plugin.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const stopRecordingTool: AgentTool = {
  name: 'stopRecording',
  description:
    'Stop recording network activity without clearing the captured plugin buffer.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const getRecordingStatusTool: AgentTool = {
  name: 'getRecordingStatus',
  description:
    'Return network activity plugin recording state and buffer metadata.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const listRequestsTool: AgentTool = {
  name: 'listRequests',
  description:
    'List captured HTTP request summaries with cursor pagination from the fallback plugin.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of requests to return. Defaults to 20.',
      },
      cursor: {
        type: 'string',
        description: 'Opaque pagination cursor from a previous listRequests call.',
      },
    },
  },
};

export const getRequestDetailsTool: AgentTool = {
  name: 'getRequestDetails',
  description:
    'Return detailed metadata for a captured HTTP request without fetching response body.',
  inputSchema: {
    type: 'object',
    properties: {
      requestId: {
        type: 'string',
        description: 'Captured plugin request ID to inspect.',
      },
    },
    required: ['requestId'],
  },
};

export const getRequestBodyTool: AgentTool = {
  name: 'getRequestBody',
  description:
    'Return the captured request body for a plugin-recorded HTTP request when available.',
  inputSchema: {
    type: 'object',
    properties: {
      requestId: {
        type: 'string',
        description: 'Captured plugin request ID to inspect.',
      },
    },
    required: ['requestId'],
  },
};

export const getResponseBodyTool: AgentTool = {
  name: 'getResponseBody',
  description:
    'Return the captured response body for a plugin-recorded HTTP request when available.',
  inputSchema: {
    type: 'object',
    properties: {
      requestId: {
        type: 'string',
        description: 'Captured plugin request ID to inspect.',
      },
    },
    required: ['requestId'],
  },
};

export const listRealtimeConnectionsTool: AgentTool = {
  name: 'listRealtimeConnections',
  description:
    'List captured WebSocket and SSE connections with cursor pagination.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of realtime connections to return. Defaults to 20.',
      },
      cursor: {
        type: 'string',
        description:
          'Opaque pagination cursor from a previous listRealtimeConnections call.',
      },
    },
  },
};

export const getRealtimeConnectionDetailsTool: AgentTool = {
  name: 'getRealtimeConnectionDetails',
  description:
    'Return details for a captured WebSocket or SSE connection, including recent messages.',
  inputSchema: {
    type: 'object',
    properties: {
      requestId: {
        type: 'string',
        description: 'Captured realtime request ID to inspect.',
      },
    },
    required: ['requestId'],
  },
};

export const NETWORK_ACTIVITY_AGENT_TOOLS: AgentTool[] = [
  startRecordingTool,
  stopRecordingTool,
  getRecordingStatusTool,
  listRequestsTool,
  getRequestDetailsTool,
  getRequestBodyTool,
  getResponseBodyTool,
  listRealtimeConnectionsTool,
  getRealtimeConnectionDetailsTool,
];
