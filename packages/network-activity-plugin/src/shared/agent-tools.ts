import {
  defineAgentToolContract,
  type AgentToolContract,
} from '@rozenite/agent-shared';
import type {
  NetworkActivityAgentBodyResult,
  NetworkActivityAgentState,
} from '../react-native/agent/state';

export const NETWORK_ACTIVITY_AGENT_PLUGIN_ID =
  '@rozenite/network-activity-plugin';

export type NetworkActivityPaginationArgs = {
  limit?: number;
  cursor?: string;
};

export type NetworkActivityRequestIdArgs = {
  requestId: string;
};

export type NetworkActivityStartRecordingArgs = undefined;

export type NetworkActivityGetRecordingStatusArgs = undefined;

export type NetworkActivityGetRecordingStatusResult = ReturnType<
  NetworkActivityAgentState['getStatus']
>;

export type NetworkActivityStartRecordingResult =
  NetworkActivityGetRecordingStatusResult & {
    started: true;
  };

export type NetworkActivityStopRecordingArgs = undefined;

export type NetworkActivityStopRecordingResult =
  NetworkActivityGetRecordingStatusResult & {
    stopped: true;
  };

export type NetworkActivityListRequestsArgs = NetworkActivityPaginationArgs;

export type NetworkActivityListRequestsResult = ReturnType<
  NetworkActivityAgentState['listRequests']
>;

export type NetworkActivityGetRequestDetailsArgs = NetworkActivityRequestIdArgs;

export type NetworkActivityGetRequestDetailsResult = ReturnType<
  NetworkActivityAgentState['getRequestDetails']
>;

export type NetworkActivityGetRequestBodyArgs = NetworkActivityRequestIdArgs;

export type NetworkActivityGetRequestBodyResult = NetworkActivityAgentBodyResult;

export type NetworkActivityGetResponseBodyArgs = NetworkActivityRequestIdArgs;

export type NetworkActivityGetResponseBodyResult = NetworkActivityAgentBodyResult;

export type NetworkActivityListRealtimeConnectionsArgs =
  NetworkActivityPaginationArgs;

export type NetworkActivityListRealtimeConnectionsResult = ReturnType<
  NetworkActivityAgentState['listRealtimeConnections']
>;

export type NetworkActivityGetRealtimeConnectionDetailsArgs =
  NetworkActivityRequestIdArgs;

export type NetworkActivityGetRealtimeConnectionDetailsResult = ReturnType<
  NetworkActivityAgentState['getRealtimeConnectionDetails']
>;

export const networkActivityToolDefinitions = {
  startRecording: defineAgentToolContract<
    NetworkActivityStartRecordingArgs,
    NetworkActivityStartRecordingResult
  >({
    name: 'startRecording',
    description:
      'Start recording network activity in the fallback network activity plugin.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  }),
  stopRecording: defineAgentToolContract<
    NetworkActivityStopRecordingArgs,
    NetworkActivityStopRecordingResult
  >({
    name: 'stopRecording',
    description:
      'Stop recording network activity without clearing the captured plugin buffer.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  }),
  getRecordingStatus: defineAgentToolContract<
    NetworkActivityGetRecordingStatusArgs,
    NetworkActivityGetRecordingStatusResult
  >({
    name: 'getRecordingStatus',
    description:
      'Return network activity plugin recording state and buffer metadata.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  }),
  listRequests: defineAgentToolContract<
    NetworkActivityListRequestsArgs,
    NetworkActivityListRequestsResult
  >({
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
          description:
            'Opaque pagination cursor from a previous listRequests call.',
        },
      },
    },
  }),
  getRequestDetails: defineAgentToolContract<
    NetworkActivityGetRequestDetailsArgs,
    NetworkActivityGetRequestDetailsResult
  >({
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
  }),
  getRequestBody: defineAgentToolContract<
    NetworkActivityGetRequestBodyArgs,
    NetworkActivityGetRequestBodyResult
  >({
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
  }),
  getResponseBody: defineAgentToolContract<
    NetworkActivityGetResponseBodyArgs,
    NetworkActivityGetResponseBodyResult
  >({
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
  }),
  listRealtimeConnections: defineAgentToolContract<
    NetworkActivityListRealtimeConnectionsArgs,
    NetworkActivityListRealtimeConnectionsResult
  >({
    name: 'listRealtimeConnections',
    description:
      'List captured WebSocket and SSE connections with cursor pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description:
            'Maximum number of realtime connections to return. Defaults to 20.',
        },
        cursor: {
          type: 'string',
          description:
            'Opaque pagination cursor from a previous listRealtimeConnections call.',
        },
      },
    },
  }),
  getRealtimeConnectionDetails: defineAgentToolContract<
    NetworkActivityGetRealtimeConnectionDetailsArgs,
    NetworkActivityGetRealtimeConnectionDetailsResult
  >({
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
  }),
} as const satisfies Record<string, AgentToolContract<unknown, unknown>>;
