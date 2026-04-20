import { useEffect } from 'react';
import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import type { NetworkActivityDevToolsClient } from '../../shared/client';
import type { NetworkInspector } from '../network-inspector';
import { getResponseBody } from '../http/http-utils';
import {
  getNetworkActivityAgentState,
} from './state';
import {
  NETWORK_ACTIVITY_AGENT_PLUGIN_ID,
  type NetworkActivityGetResponseBodyResult,
} from '../../shared/agent-tools';
import {
  getRecordingStatusTool,
  getRealtimeConnectionDetailsTool,
  getRequestBodyTool,
  getRequestDetailsTool,
  getResponseBodyTool,
  listRealtimeConnectionsTool,
  listRequestsTool,
  startRecordingTool,
  stopRecordingTool,
} from './tools';

type AgentToolsConfig = {
  client: NetworkActivityDevToolsClient | null;
  networkInspector: NetworkInspector;
  enabledInspectors: {
    http: boolean;
    websocket: boolean;
    sse: boolean;
  };
};

export const useNetworkActivityAgentTools = ({
  client,
  networkInspector,
  enabledInspectors,
}: AgentToolsConfig) => {
  const state = getNetworkActivityAgentState();

  useEffect(() => {
    const unsubscribe = [
      networkInspector.http.on('request-sent', (event) =>
        state.onRequestSent(event)
      ),
      networkInspector.http.on('request-progress', (event) =>
        state.onRequestProgress(event)
      ),
      networkInspector.http.on('response-received', (event) =>
        state.onResponseReceived(event)
      ),
      networkInspector.http.on('request-completed', (event) =>
        state.onRequestCompleted(event)
      ),
      networkInspector.http.on('request-failed', (event) =>
        state.onRequestFailed(event)
      ),
      networkInspector.websocket.on('websocket-connect', (event) =>
        state.onWebSocketConnect(event)
      ),
      networkInspector.websocket.on('websocket-open', (event) =>
        state.onWebSocketOpen(event)
      ),
      networkInspector.websocket.on('websocket-close', (event) =>
        state.onWebSocketClose(event)
      ),
      networkInspector.websocket.on('websocket-message-sent', (event) =>
        state.onWebSocketMessageSent(event)
      ),
      networkInspector.websocket.on('websocket-message-received', (event) =>
        state.onWebSocketMessageReceived(event)
      ),
      networkInspector.websocket.on('websocket-error', (event) =>
        state.onWebSocketError(event)
      ),
      networkInspector.websocket.on('websocket-connection-status-changed', (event) =>
        state.onWebSocketConnectionStatusChanged(event)
      ),
      networkInspector.sse.on('sse-open', (event) => state.onSSEOpen(event)),
      networkInspector.sse.on('sse-message', (event) => state.onSSEMessage(event)),
      networkInspector.sse.on('sse-error', (event) => state.onSSEError(event)),
      networkInspector.sse.on('sse-close', (event) => state.onSSEClose(event)),
    ];

    return () => {
      unsubscribe.forEach((remove) => remove());
    };
  }, [networkInspector, state]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscriptions = [
      client.onMessage('network-enable', () => {
        state.startRecording({ enabledInspectors });
      }),
      client.onMessage('network-disable', () => {
        if (state.getStatus().recording.isRecording) {
          state.stopRecording();
        }
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [client, enabledInspectors, state]);

  useRozenitePluginAgentTool({
    pluginId: NETWORK_ACTIVITY_AGENT_PLUGIN_ID,
    tool: startRecordingTool,
    handler: () => {
      networkInspector.http.getNetworkRequestsRegistry().clear();
      const result = state.startRecording({ enabledInspectors });
      networkInspector.enable(enabledInspectors);
      return {
        started: true as const,
        ...result,
      };
    },
  });

  useRozenitePluginAgentTool({
    pluginId: NETWORK_ACTIVITY_AGENT_PLUGIN_ID,
    tool: stopRecordingTool,
    handler: () => {
      const result = state.stopRecording();
      networkInspector.disable();
      return {
        stopped: true as const,
        ...result,
      };
    },
  });

  useRozenitePluginAgentTool({
    pluginId: NETWORK_ACTIVITY_AGENT_PLUGIN_ID,
    tool: getRecordingStatusTool,
    handler: () => state.getStatus(),
  });

  useRozenitePluginAgentTool({
    pluginId: NETWORK_ACTIVITY_AGENT_PLUGIN_ID,
    tool: listRequestsTool,
    handler: (input = {}) => state.listRequests(input),
  });

  useRozenitePluginAgentTool({
    pluginId: NETWORK_ACTIVITY_AGENT_PLUGIN_ID,
    tool: getRequestDetailsTool,
    handler: ({ requestId }) => state.getRequestDetails(requestId),
  });

  useRozenitePluginAgentTool({
    pluginId: NETWORK_ACTIVITY_AGENT_PLUGIN_ID,
    tool: getRequestBodyTool,
    handler: ({ requestId }) => state.getRequestBody(requestId),
  });

  useRozenitePluginAgentTool({
    pluginId: NETWORK_ACTIVITY_AGENT_PLUGIN_ID,
    tool: getResponseBodyTool,
    handler: async ({ requestId }): Promise<NetworkActivityGetResponseBodyResult> => {
      const record = state.getHttpRecord(requestId);
      if (!record) {
        throw new Error(`Unknown request "${requestId}"`);
      }

      if (record.status === 'failed') {
        return {
          requestId,
          available: false,
          reason: 'Response body is unavailable because the request failed.',
        };
      }

      if (record.status !== 'finished') {
        return {
          requestId,
          available: false,
          reason:
            'Response body is unavailable until the request finishes loading.',
        };
      }

      const request =
        networkInspector.http.getNetworkRequestsRegistry().getEntry(requestId);
      if (!request) {
        return {
          requestId,
          available: false,
          reason:
            'Response body is unavailable because the request object is no longer in the plugin registry.',
        };
      }

      const body = await getResponseBody(request);
      if (body === null) {
        return {
          requestId,
          available: false,
          reason:
            'The plugin could not extract a text response body for this request.',
        };
      }

      return {
        requestId,
        available: true,
        body,
        base64Encoded: false,
        decoded: false,
        mimeType: record.response?.contentType,
      };
    },
  });

  useRozenitePluginAgentTool({
    pluginId: NETWORK_ACTIVITY_AGENT_PLUGIN_ID,
    tool: listRealtimeConnectionsTool,
    handler: (input = {}) => state.listRealtimeConnections(input),
  });

  useRozenitePluginAgentTool({
    pluginId: NETWORK_ACTIVITY_AGENT_PLUGIN_ID,
    tool: getRealtimeConnectionDetailsTool,
    handler: ({ requestId }) => state.getRealtimeConnectionDetails(requestId),
  });
};
