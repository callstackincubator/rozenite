import { memoize } from 'proxy-memoize';
import { NetworkActivityState } from './store';
import {
  ProcessedRequest,
  HttpNetworkEntry,
  WebSocketNetworkEntry,
  SSENetworkEntry,
} from './model';

export const getProcessedRequests = memoize((state: NetworkActivityState) => {
  const { networkEntries } = state;
  const requests: ProcessedRequest[] = [];

  for (const entry of networkEntries.values()) {
    if (entry.type === 'http') {
      const httpEntry = entry as HttpNetworkEntry;
      requests.push({
        id: httpEntry.id,
        type: 'http',
        name: httpEntry.request.url,
        status: httpEntry.status,
        timestamp: httpEntry.timestamp,
        duration: httpEntry.duration,
        size: httpEntry.size,
        method: httpEntry.request.method,
        httpStatus: httpEntry.response?.status,
      });
    } else if (entry.type === 'websocket') {
      const wsEntry = entry as WebSocketNetworkEntry;
      requests.push({
        id: wsEntry.id,
        type: 'websocket',
        name: wsEntry.connection.url,
        status: wsEntry.status,
        timestamp: wsEntry.timestamp,
        duration: wsEntry.duration,
        method: 'WS',
        httpStatus: 0,
      });
    } else if (entry.type === 'sse') {
      const sseEntry = entry as SSENetworkEntry;
      requests.push({
        id: sseEntry.id,
        type: 'sse',
        name: sseEntry.request.url,
        status: sseEntry.status,
        timestamp: sseEntry.timestamp,
        duration: sseEntry.duration,
        method: 'SSE',
        httpStatus: 0,
      });
    }
  }

  return requests.sort((a, b) => b.timestamp - a.timestamp);
});

export const getSelectedRequest = memoize((state: NetworkActivityState) => {
  const { selectedRequestId, networkEntries } = state;
  if (!selectedRequestId) return null;
  return networkEntries.get(selectedRequestId) || null;
});

export const getRequestSummary = (
  requestId: string
): ((state: NetworkActivityState) => ProcessedRequest | null) =>
  memoize((state: NetworkActivityState) => {
    const { networkEntries } = state;
    const entry = networkEntries.get(requestId);
    if (!entry) return null;

    if (entry.type === 'http') {
      const httpEntry = entry as HttpNetworkEntry;
      return {
        id: httpEntry.id,
        type: 'http',
        name: httpEntry.request.url,
        status: httpEntry.status,
        timestamp: httpEntry.timestamp,
        duration: httpEntry.duration,
        size: httpEntry.size,
        method: httpEntry.request.method,
        httpStatus: httpEntry.response?.status || 0,
      };
    } else if (entry.type === 'websocket') {
      const wsEntry = entry as WebSocketNetworkEntry;
      return {
        id: wsEntry.id,
        type: 'websocket',
        name: wsEntry.connection.url,
        status: wsEntry.status,
        timestamp: wsEntry.timestamp,
        duration: wsEntry.duration,
        method: 'WS',
        httpStatus: 0,
      };
    } else if (entry.type === 'sse') {
      const sseEntry = entry as SSENetworkEntry;
      return {
        id: sseEntry.id,
        type: 'sse',
        name: sseEntry.request.url,
        status: sseEntry.status,
        timestamp: sseEntry.timestamp,
        duration: sseEntry.duration,
        method: 'SSE',
        httpStatus: 0,
      };
    }

    return null;
  });
