import { defineAgentToolDescriptors } from '@rozenite/agent-shared';
import {
  NETWORK_ACTIVITY_AGENT_PLUGIN_ID,
  networkActivityToolDefinitions,
} from './src/shared/agent-tools.js';

export {
  NETWORK_ACTIVITY_AGENT_PLUGIN_ID,
  networkActivityToolDefinitions,
};

export const networkActivityTools = defineAgentToolDescriptors(
  NETWORK_ACTIVITY_AGENT_PLUGIN_ID,
  networkActivityToolDefinitions,
);

export type {
  NetworkActivityGetRealtimeConnectionDetailsArgs,
  NetworkActivityGetRealtimeConnectionDetailsResult,
  NetworkActivityGetRecordingStatusArgs,
  NetworkActivityGetRecordingStatusResult,
  NetworkActivityGetRequestBodyArgs,
  NetworkActivityGetRequestBodyResult,
  NetworkActivityGetRequestDetailsArgs,
  NetworkActivityGetRequestDetailsResult,
  NetworkActivityGetResponseBodyArgs,
  NetworkActivityGetResponseBodyResult,
  NetworkActivityListRealtimeConnectionsArgs,
  NetworkActivityListRealtimeConnectionsResult,
  NetworkActivityListRequestsArgs,
  NetworkActivityListRequestsResult,
  NetworkActivityPaginationArgs,
  NetworkActivityRequestIdArgs,
  NetworkActivityStartRecordingArgs,
  NetworkActivityStartRecordingResult,
  NetworkActivityStopRecordingArgs,
  NetworkActivityStopRecordingResult,
} from './src/shared/agent-tools.js';

export type {
  NetworkActivityAgentBodyResult,
  NetworkActivityAgentState,
} from './src/react-native/agent/state.js';

export type {
  Cookie,
  HttpHeaders,
  HttpMethod,
  Initiator,
  Request,
  RequestBinaryPostData,
  RequestFormDataPostData,
  RequestId,
  RequestOverride,
  RequestPostData,
  RequestTextPostData,
  ResourceType,
  Response,
} from './src/shared/http-events.js';
