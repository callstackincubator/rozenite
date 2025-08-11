import { createStore } from 'zustand';
import {
  NetworkActivityDevToolsClient,
  NetworkActivityEventMap,
  RequestId,
} from '../../shared/client';
import {
  NetworkEntry,
  HttpNetworkEntry,
  WebSocketNetworkEntry,
  WebSocketMessage,
  SSENetworkEntry,
  SSEMessage,
} from './model';
import { getHttpHeaderValue } from '../utils/getHttpHeaderValue';
import { getId } from '../utils/getId';
import { assert } from '../utils/assert';

const MAX_WEBSOCKET_MESSAGES_PER_CONNECTION = 32;
const MAX_SSE_MESSAGES_PER_CONNECTION = 32;

export interface NetworkActivityState {
  // State
  isRecording: boolean;
  selectedRequestId: RequestId | null;
  networkEntries: Map<RequestId, NetworkEntry>;
  websocketMessages: Map<RequestId, WebSocketMessage[]>;

  // Internal state (not exposed in interface)
  _unsubscribeFunctions?: Array<{ remove: () => void }>;
  _client?: NetworkActivityDevToolsClient;

  // Actions
  actions: {
    setRecording: (isRecording: boolean) => void;
    setSelectedRequest: (requestId: RequestId | null) => void;
    clearRequests: () => void;
  };

  // Event handling
  handleEvent: <K extends keyof NetworkActivityEventMap>(
    eventType: K,
    data: NetworkActivityEventMap[K]
  ) => void;

  // Client management
  client: {
    setupClient: (client: NetworkActivityDevToolsClient) => void;
    cleanupClient: () => void;
  };
}

export const createNetworkActivityStore = () =>
  createStore<NetworkActivityState>((set, get) => ({
    // Initial state
    isRecording: false,
    selectedRequestId: null,
    networkEntries: new Map(),
    websocketMessages: new Map(),

    // Actions
    actions: {
      setRecording: (isRecording: boolean) => {
        const { _client } = get();
        assert(!!_client, 'Client is not set');

        _client.send(isRecording ? 'network-enable' : 'network-disable', {});
        set({ isRecording });
      },
      setSelectedRequest: (requestId: RequestId | null) =>
        set({ selectedRequestId: requestId }),
      clearRequests: () =>
        set({
          networkEntries: new Map(),
          websocketMessages: new Map(),
          selectedRequestId: null,
        }),
    },
    // Event handling
    handleEvent: <K extends keyof NetworkActivityEventMap>(
      eventType: K,
      data: NetworkActivityEventMap[K]
    ) => {
      switch (eventType) {
        case 'request-sent': {
          const eventData = data as NetworkActivityEventMap['request-sent'];
          set((state) => {
            const entry: HttpNetworkEntry = {
              id: eventData.requestId,
              type: 'http',
              timestamp: eventData.timestamp,
              request: {
                url: eventData.request.url,
                method: eventData.request.method,
                headers: eventData.request.headers,
                body: eventData.request.postData
                  ? {
                      type:
                        getHttpHeaderValue(
                          eventData.request.headers,
                          'content-type'
                        )?.split(';')[0] || 'text/plain',
                      data: eventData.request.postData,
                    }
                  : undefined,
              },
              status: 'pending',
              initiator: eventData.initiator,
              resourceType: eventData.type,
            };

            const newEntries = new Map(state.networkEntries);
            newEntries.set(eventData.requestId, entry);
            return { networkEntries: newEntries };
          });
          break;
        }

        case 'response-received': {
          const eventData =
            data as NetworkActivityEventMap['response-received'];
          set((state) => {
            const entry = state.networkEntries.get(eventData.requestId);
            if (!entry || entry.type !== 'http') return state;

            const httpEntry = entry as HttpNetworkEntry;
            const updatedEntry: HttpNetworkEntry = {
              ...httpEntry,
              status: 'loading',
              response: eventData.response,
            };

            const newEntries = new Map(state.networkEntries);
            newEntries.set(eventData.requestId, updatedEntry);
            return { networkEntries: newEntries };
          });
          break;
        }

        case 'request-completed': {
          const eventData =
            data as NetworkActivityEventMap['request-completed'];
          set((state) => {
            const entry = state.networkEntries.get(eventData.requestId);
            if (!entry || entry.type !== 'http') return state;

            const httpEntry = entry as HttpNetworkEntry;
            const updatedEntry: HttpNetworkEntry = {
              ...httpEntry,
              status: 'finished',
              duration: eventData.duration,
              size: eventData.size,
              ttfb: eventData.ttfb,
            };

            const newEntries = new Map(state.networkEntries);
            newEntries.set(eventData.requestId, updatedEntry);
            return { networkEntries: newEntries };
          });
          break;
        }

        case 'request-failed': {
          const eventData = data as NetworkActivityEventMap['request-failed'];
          set((state) => {
            const entry = state.networkEntries.get(eventData.requestId);
            if (!entry || entry.type !== 'http') return state;

            const httpEntry = entry as HttpNetworkEntry;
            const updatedEntry: HttpNetworkEntry = {
              ...httpEntry,
              status: 'failed',
              error: eventData.error,
            };

            const newEntries = new Map(state.networkEntries);
            newEntries.set(eventData.requestId, updatedEntry);
            return { networkEntries: newEntries };
          });
          break;
        }

        case 'response-body': {
          const eventData = data as NetworkActivityEventMap['response-body'];
          set((state) => {
            const entry = state.networkEntries.get(eventData.requestId);
            if (!entry || entry.type !== 'http') return state;

            const httpEntry = entry as HttpNetworkEntry;
            const updatedEntry: HttpNetworkEntry = {
              ...httpEntry,
              response: httpEntry.response
                ? {
                    ...httpEntry.response,
                    body: eventData.body
                      ? {
                          type:
                            getHttpHeaderValue(
                              httpEntry.response?.headers ?? {},
                              'content-type'
                            )?.split(';')[0] || 'text/plain',
                          data: eventData.body,
                        }
                      : undefined,
                  }
                : undefined,
            };

            const newEntries = new Map(state.networkEntries);
            newEntries.set(eventData.requestId, updatedEntry);
            return { networkEntries: newEntries };
          });
          break;
        }

        case 'websocket-connect': {
          const eventData =
            data as NetworkActivityEventMap['websocket-connect'];
          set((state) => {
            const entry: WebSocketNetworkEntry = {
              id: `ws-${eventData.socketId}`,
              type: 'websocket',
              timestamp: eventData.timestamp,
              connection: {
                url: eventData.url,
                socketId: eventData.socketId,
                protocols: eventData.protocols || undefined,
                options: eventData.options,
              },
              status: 'connecting',
            };

            const newEntries = new Map(state.networkEntries);
            newEntries.set(entry.id, entry);

            const newMessages = new Map(state.websocketMessages);
            newMessages.set(entry.id, []);

            return {
              networkEntries: newEntries,
              websocketMessages: newMessages,
            };
          });
          break;
        }

        case 'websocket-open': {
          const eventData = data as NetworkActivityEventMap['websocket-open'];
          set((state) => {
            const entry = state.networkEntries.get(`ws-${eventData.socketId}`);
            if (!entry || entry.type !== 'websocket') return state;

            const wsEntry = entry as WebSocketNetworkEntry;
            const updatedEntry: WebSocketNetworkEntry = {
              ...wsEntry,
              status: 'open',
            };

            const newEntries = new Map(state.networkEntries);
            newEntries.set(entry.id, updatedEntry);
            return { networkEntries: newEntries };
          });
          break;
        }

        case 'websocket-close': {
          const eventData = data as NetworkActivityEventMap['websocket-close'];
          set((state) => {
            const entry = state.networkEntries.get(`ws-${eventData.socketId}`);
            if (!entry || entry.type !== 'websocket') return state;

            const wsEntry = entry as WebSocketNetworkEntry;
            const updatedEntry: WebSocketNetworkEntry = {
              ...wsEntry,
              status: 'closed',
              closeCode: eventData.code,
              closeReason: eventData.reason,
              duration: eventData.timestamp - wsEntry.timestamp,
            };

            const newEntries = new Map(state.networkEntries);
            newEntries.set(entry.id, updatedEntry);
            return { networkEntries: newEntries };
          });
          break;
        }

        case 'websocket-message-sent': {
          const eventData =
            data as NetworkActivityEventMap['websocket-message-sent'];
          set((state) => {
            const socketId = `ws-${eventData.socketId}`;
            const currentMessages = state.websocketMessages.get(socketId) || [];

            const message: WebSocketMessage = {
              id: getId(`${socketId}-message`),
              direction: 'sent',
              data: eventData.data,
              messageType: eventData.messageType,
              timestamp: eventData.timestamp,
            };

            const newMessages = new Map(state.websocketMessages);
            newMessages.set(
              socketId,
              [...currentMessages, message].slice(
                -MAX_WEBSOCKET_MESSAGES_PER_CONNECTION
              )
            );

            return { websocketMessages: newMessages };
          });
          break;
        }

        case 'websocket-message-received': {
          const eventData =
            data as NetworkActivityEventMap['websocket-message-received'];
          set((state) => {
            const socketId = `ws-${eventData.socketId}`;
            const currentMessages = state.websocketMessages.get(socketId) || [];

            const message: WebSocketMessage = {
              id: getId(`${socketId}-message`),
              direction: 'received',
              data: eventData.data,
              messageType: eventData.messageType,
              timestamp: eventData.timestamp,
            };

            const newMessages = new Map(state.websocketMessages);
            newMessages.set(
              socketId,
              [...currentMessages, message].slice(
                -MAX_WEBSOCKET_MESSAGES_PER_CONNECTION
              )
            );

            return { websocketMessages: newMessages };
          });
          break;
        }

        case 'websocket-error': {
          const eventData = data as NetworkActivityEventMap['websocket-error'];
          set((state) => {
            const entry = state.networkEntries.get(`ws-${eventData.socketId}`);
            if (!entry || entry.type !== 'websocket') return state;

            const wsEntry = entry as WebSocketNetworkEntry;
            const updatedEntry: WebSocketNetworkEntry = {
              ...wsEntry,
              status: 'error',
              error: eventData.error,
            };

            const newEntries = new Map(state.networkEntries);
            newEntries.set(entry.id, updatedEntry);
            return { networkEntries: newEntries };
          });
          break;
        }

        case 'websocket-connection-status-changed': {
          const eventData =
            data as NetworkActivityEventMap['websocket-connection-status-changed'];
          set((state) => {
            const entry = state.networkEntries.get(`ws-${eventData.socketId}`);
            if (!entry || entry.type !== 'websocket') return state;

            const wsEntry = entry as WebSocketNetworkEntry;
            const updatedEntry: WebSocketNetworkEntry = {
              ...wsEntry,
              status: eventData.status,
            };

            const newEntries = new Map(state.networkEntries);
            newEntries.set(entry.id, updatedEntry);
            return { networkEntries: newEntries };
          });
          break;
        }

        case 'sse-open': {
          const eventData = data as NetworkActivityEventMap['sse-open'];
          set((state) => {
            const entry = state.networkEntries.get(eventData.requestId);
            if (!entry || entry.type !== 'http') return state;

            // Transform the existing HTTP entry to SSE
            const httpEntry = entry as HttpNetworkEntry;
            const sseEntry: SSENetworkEntry = {
              ...httpEntry,
              type: 'sse', // Change type from 'http' to 'sse'
              status: 'open', // Update status
              messages: [], // Add SSE-specific field
              response: eventData.response,
            };

            const newEntries = new Map(state.networkEntries);
            newEntries.set(eventData.requestId, sseEntry);
            return { networkEntries: newEntries };
          });
          break;
        }

        case 'sse-message': {
          const eventData = data as NetworkActivityEventMap['sse-message'];
          set((state) => {
            const entry = state.networkEntries.get(eventData.requestId);
            if (!entry || entry.type !== 'sse') return state;

            const sseEntry = entry as SSENetworkEntry;
            const newMessage: SSEMessage = {
              id: getId(`${eventData.requestId}-message`),
              type: eventData.payload.type,
              data: eventData.payload.data,
              timestamp: eventData.timestamp,
            };

            const updatedEntry: SSENetworkEntry = {
              ...sseEntry,
              messages: [...sseEntry.messages, newMessage].slice(
                -MAX_SSE_MESSAGES_PER_CONNECTION
              ),
            };

            const newEntries = new Map(state.networkEntries);
            newEntries.set(eventData.requestId, updatedEntry);
            return { networkEntries: newEntries };
          });
          break;
        }

        case 'sse-error': {
          const eventData = data as NetworkActivityEventMap['sse-error'];
          set((state) => {
            const entry = state.networkEntries.get(eventData.requestId);
            if (!entry || entry.type !== 'sse') return state;

            const sseEntry = entry as SSENetworkEntry;
            const updatedEntry: SSENetworkEntry = {
              ...sseEntry,
              status: 'error',
              error: eventData.error.message,
            };

            const newEntries = new Map(state.networkEntries);
            newEntries.set(eventData.requestId, updatedEntry);
            return { networkEntries: newEntries };
          });
          break;
        }

        case 'sse-close': {
          const eventData = data as NetworkActivityEventMap['sse-close'];
          set((state) => {
            const entry = state.networkEntries.get(eventData.requestId);
            if (!entry || entry.type !== 'sse') return state;

            const sseEntry = entry as SSENetworkEntry;
            const updatedEntry: SSENetworkEntry = {
              ...sseEntry,
              status: 'closed',
              duration: eventData.timestamp - sseEntry.timestamp,
            };

            const newEntries = new Map(state.networkEntries);
            newEntries.set(eventData.requestId, updatedEntry);
            return { networkEntries: newEntries };
          });
          break;
        }
      }
    },

    // Client management
    client: {
      setupClient: (client: NetworkActivityDevToolsClient) => {
        const { handleEvent } = get();

        // Subscribe to all events using the unified handler
        const unsubscribeFunctions = [
          client.onMessage('request-sent', (data) =>
            handleEvent('request-sent', data)
          ),
          client.onMessage('response-received', (data) =>
            handleEvent('response-received', data)
          ),
          client.onMessage('request-completed', (data) =>
            handleEvent('request-completed', data)
          ),
          client.onMessage('request-failed', (data) =>
            handleEvent('request-failed', data)
          ),
          client.onMessage('response-body', (data) =>
            handleEvent('response-body', data)
          ),
          client.onMessage('websocket-connect', (data) =>
            handleEvent('websocket-connect', data)
          ),
          client.onMessage('websocket-open', (data) =>
            handleEvent('websocket-open', data)
          ),
          client.onMessage('websocket-close', (data) =>
            handleEvent('websocket-close', data)
          ),
          client.onMessage('websocket-message-sent', (data) =>
            handleEvent('websocket-message-sent', data)
          ),
          client.onMessage('websocket-message-received', (data) =>
            handleEvent('websocket-message-received', data)
          ),
          client.onMessage('websocket-error', (data) =>
            handleEvent('websocket-error', data)
          ),
          client.onMessage('websocket-connection-status-changed', (data) =>
            handleEvent('websocket-connection-status-changed', data)
          ),
          client.onMessage('sse-open', (data) => handleEvent('sse-open', data)),
          client.onMessage('sse-message', (data) =>
            handleEvent('sse-message', data)
          ),
          client.onMessage('sse-error', (data) =>
            handleEvent('sse-error', data)
          ),
          client.onMessage('sse-close', (data) =>
            handleEvent('sse-close', data)
          ),
        ];

        // Store unsubscribe functions in the state for cleanup
        set({
          _unsubscribeFunctions: unsubscribeFunctions,
          _client: client,
        });
      },

      cleanupClient: () => {
        const { _unsubscribeFunctions, _client } = get();

        if (_unsubscribeFunctions) {
          _unsubscribeFunctions.forEach((unsubscribe: { remove: () => void }) =>
            unsubscribe.remove()
          );
        }

        if (_client) {
          _client.send('network-disable', {});
        }

        set({
          _unsubscribeFunctions: undefined,
          _client: undefined,
        });
      },
    },
  }));

export const store = createNetworkActivityStore();
