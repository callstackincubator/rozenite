import { networkActivityToolDefinitions } from '../../shared/agent-tools';

export const startRecordingTool = networkActivityToolDefinitions.startRecording;
export const stopRecordingTool = networkActivityToolDefinitions.stopRecording;
export const getRecordingStatusTool =
  networkActivityToolDefinitions.getRecordingStatus;
export const listRequestsTool = networkActivityToolDefinitions.listRequests;
export const getRequestDetailsTool =
  networkActivityToolDefinitions.getRequestDetails;
export const getRequestBodyTool = networkActivityToolDefinitions.getRequestBody;
export const getResponseBodyTool =
  networkActivityToolDefinitions.getResponseBody;
export const listRealtimeConnectionsTool =
  networkActivityToolDefinitions.listRealtimeConnections;
export const getRealtimeConnectionDetailsTool =
  networkActivityToolDefinitions.getRealtimeConnectionDetails;

export const NETWORK_ACTIVITY_AGENT_TOOLS = Object.values(
  networkActivityToolDefinitions,
);
