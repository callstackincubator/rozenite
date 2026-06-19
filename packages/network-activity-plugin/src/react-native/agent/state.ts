import type {
  HttpEventMap,
  Request,
  RequestId,
  RequestPostData,
  Response,
  ResourceType,
  Initiator,
} from '../../shared/client';
import type { WebSocketEventMap } from '../../shared/websocket-events';
import type { SSEEventMap } from '../../shared/sse-events';
import { safeStringify } from '../../utils/safeStringify';

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;
const HTTP_BUFFER_CAPACITY = 500;
const REALTIME_BUFFER_CAPACITY = 200;
const MAX_WEBSOCKET_MESSAGES_PER_CONNECTION = 32;
const MAX_SSE_MESSAGES_PER_CONNECTION = 32;

type HttpAgentRecord = {
  requestId: RequestId;
  request: Request;
  resourceType: ResourceType;
  initiator: Initiator;
  startTimeMs: number;
  status: 'pending' | 'loading' | 'finished' | 'failed';
  progress?: HttpEventMap['request-progress'];
  response?: Response;
  endTimeMs?: number;
  durationMs?: number;
  size?: number | null;
  ttfb?: number;
  error?: string;
  canceled?: boolean;
};

type WebSocketAgentMessage = {
  id: string;
  direction: 'sent' | 'received';
  data: string;
  messageType: 'text' | 'binary';
  timestamp: number;
};

type WebSocketAgentRecord = {
  requestId: string;
  kind: 'websocket';
  url: string;
  socketId: string;
  status: 'connecting' | 'open' | 'closing' | 'closed' | 'error';
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  protocols?: string[] | null;
  options?: string[];
  error?: string;
  closeCode?: number;
  closeReason?: string;
  messages: WebSocketAgentMessage[];
};

type SSEAgentMessage = {
  id: string;
  type: string;
  data: string;
  timestamp: number;
};

type SSEAgentRecord = {
  requestId: string;
  kind: 'sse';
  status: 'connecting' | 'open' | 'closed' | 'error';
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  request?: Request;
  response?: Response;
  initiator?: Initiator;
  resourceType?: ResourceType;
  error?: string;
  messages: SSEAgentMessage[];
};

type RealtimeAgentRecord = WebSocketAgentRecord | SSEAgentRecord;

export type NetworkActivityAgentBodyResult = {
  requestId: string;
  available: boolean;
  body?: string;
  base64Encoded?: boolean;
  decoded?: boolean;
  mimeType?: string;
  reason?: string;
};

type RecordingMetadata = {
  enabledInspectors: {
    http: boolean;
    websocket: boolean;
    sse: boolean;
  };
};

type NetworkActivityAgentStateInternal = {
  isRecording: boolean;
  startedAt?: number;
  stoppedAt?: number;
  generation: number;
  httpOrder: string[];
  httpRecords: Map<string, HttpAgentRecord>;
  httpTotalRecorded: number;
  httpEvictedCount: number;
  httpTruncated: boolean;
  realtimeOrder: string[];
  realtimeRecords: Map<string, RealtimeAgentRecord>;
  realtimeTotalRecorded: number;
  realtimeEvictedCount: number;
  realtimeTruncated: boolean;
  nextMessageId: number;
  recordingMetadata: RecordingMetadata;
};

type Page<T> = {
  items: T[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
};

const createInitialState = (): NetworkActivityAgentStateInternal => ({
  isRecording: false,
  generation: 0,
  httpOrder: [],
  httpRecords: new Map(),
  httpTotalRecorded: 0,
  httpEvictedCount: 0,
  httpTruncated: false,
  realtimeOrder: [],
  realtimeRecords: new Map(),
  realtimeTotalRecorded: 0,
  realtimeEvictedCount: 0,
  realtimeTruncated: false,
  nextMessageId: 1,
  recordingMetadata: {
    enabledInspectors: {
      http: true,
      websocket: true,
      sse: true,
    },
  },
});

const getLimit = (value: unknown): number => {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    !Number.isFinite(value) ||
    value < 1
  ) {
    return DEFAULT_PAGE_LIMIT;
  }

  return Math.min(value, MAX_PAGE_LIMIT);
};

const encodeCursor = (scope: string, index: number): string => {
  return `${scope}:${index}`;
};

const decodeCursor = (cursor: string, scope: string): number => {
  const [cursorScope, rawIndex] = cursor.split(':', 2);
  if (cursorScope !== scope || !rawIndex) {
    throw new Error(
      'Cursor does not match the requested listing. Run the command again.',
    );
  }

  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('Cursor is invalid. Run the command again.');
  }

  return index;
};

const paginate = <T>(
  rows: T[],
  scope: string,
  limit: number,
  cursor?: string,
): Page<T> => {
  const startIndex = cursor ? decodeCursor(cursor, scope) : 0;
  const endIndex = Math.min(startIndex + limit, rows.length);
  const hasMore = endIndex < rows.length;

  return {
    items: rows.slice(startIndex, endIndex),
    page: {
      limit,
      hasMore,
      ...(hasMore ? { nextCursor: encodeCursor(scope, endIndex) } : {}),
    },
  };
};

const serializeRequestBody = (
  requestId: string,
  postData?: RequestPostData,
): NetworkActivityAgentBodyResult => {
  if (!postData) {
    return {
      requestId,
      available: false,
      reason: 'No request body is available for this request.',
    };
  }

  if (postData.type === 'text') {
    return {
      requestId,
      available: true,
      body: postData.value,
      base64Encoded: false,
    };
  }

  return {
    requestId,
    available: true,
    body: safeStringify(postData),
    base64Encoded: false,
  };
};

const createHttpSummary = (record: HttpAgentRecord) => ({
  requestId: record.requestId,
  method: record.request.method,
  url: record.request.url,
  status: record.response?.status ?? null,
  type: record.resourceType,
  startTimeMs: record.startTimeMs,
  endTimeMs: record.endTimeMs ?? null,
  durationMs: record.durationMs ?? null,
  transferSize: record.size ?? null,
  encodedDataLength: record.response?.size ?? null,
  outcome:
    record.status === 'failed'
      ? 'failed'
      : record.status === 'finished'
        ? 'success'
        : 'in-flight',
});

const getRealtimeSummary = (record: RealtimeAgentRecord) => {
  if (record.kind === 'websocket') {
    return {
      requestId: record.requestId,
      kind: record.kind,
      url: record.url,
      status: record.status,
      startedAt: record.startedAt,
      endedAt: record.endedAt ?? null,
      durationMs: record.durationMs ?? null,
      messageCount: record.messages.length,
      error: record.error ?? null,
      closeCode: record.closeCode ?? null,
    };
  }

  return {
    requestId: record.requestId,
    kind: record.kind,
    url: record.request?.url ?? record.response?.url ?? null,
    status: record.status,
    startedAt: record.startedAt,
    endedAt: record.endedAt ?? null,
    durationMs: record.durationMs ?? null,
    messageCount: record.messages.length,
    error: record.error ?? null,
    httpStatus: record.response?.status ?? null,
  };
};

const trimMap = <T>(
  order: string[],
  records: Map<string, T>,
  capacity: number,
): number => {
  let evicted = 0;
  while (order.length > capacity) {
    const oldestId = order.shift();
    if (!oldestId) {
      break;
    }
    records.delete(oldestId);
    evicted += 1;
  }
  return evicted;
};

export const createNetworkActivityAgentState = () => {
  const state = createInitialState();

  const getStatus = () => ({
    recording: {
      isRecording: state.isRecording,
      startedAt: state.startedAt ?? null,
      stoppedAt: state.stoppedAt ?? null,
      httpRequestCount: state.httpOrder.length,
      realtimeConnectionCount: state.realtimeOrder.length,
      http: {
        totalRecorded: state.httpTotalRecorded,
        evictedCount: state.httpEvictedCount,
        truncated: state.httpTruncated,
        capacity: HTTP_BUFFER_CAPACITY,
      },
      realtime: {
        totalRecorded: state.realtimeTotalRecorded,
        evictedCount: state.realtimeEvictedCount,
        truncated: state.realtimeTruncated,
        capacity: REALTIME_BUFFER_CAPACITY,
      },
      generation: state.generation,
      enabledInspectors: state.recordingMetadata.enabledInspectors,
    },
  });

  const ensureHttpRecord = (
    requestId: string,
    fallback?: Partial<HttpAgentRecord>,
  ): HttpAgentRecord => {
    const existing = state.httpRecords.get(requestId);
    if (existing) {
      return existing;
    }

    const record: HttpAgentRecord = {
      requestId,
      request:
        fallback?.request ||
        ({
          url: '',
          method: 'GET',
          headers: {},
        } as Request),
      resourceType: fallback?.resourceType || 'Other',
      initiator: fallback?.initiator || { type: 'other' },
      startTimeMs: fallback?.startTimeMs ?? Date.now(),
      status: fallback?.status || 'pending',
    };
    state.httpRecords.set(requestId, record);
    state.httpOrder.push(requestId);
    state.httpTotalRecorded += 1;
    const evicted = trimMap(
      state.httpOrder,
      state.httpRecords,
      HTTP_BUFFER_CAPACITY,
    );
    if (evicted > 0) {
      state.httpEvictedCount += evicted;
      state.httpTruncated = true;
    }
    return record;
  };

  const ensureRealtimeRecord = (
    requestId: string,
    createRecord: () => RealtimeAgentRecord,
  ): RealtimeAgentRecord => {
    const existing = state.realtimeRecords.get(requestId);
    if (existing) {
      return existing;
    }

    const record = createRecord();
    state.realtimeRecords.set(requestId, record);
    state.realtimeOrder.push(requestId);
    state.realtimeTotalRecorded += 1;
    const evicted = trimMap(
      state.realtimeOrder,
      state.realtimeRecords,
      REALTIME_BUFFER_CAPACITY,
    );
    if (evicted > 0) {
      state.realtimeEvictedCount += evicted;
      state.realtimeTruncated = true;
    }
    return record;
  };

  const nextMessageId = (prefix: string) => {
    const id = `${prefix}-${state.nextMessageId}`;
    state.nextMessageId += 1;
    return id;
  };

  return {
    startRecording(metadata?: Partial<RecordingMetadata>) {
      state.isRecording = true;
      state.startedAt = Date.now();
      state.stoppedAt = undefined;
      state.generation += 1;
      state.httpOrder = [];
      state.httpRecords.clear();
      state.httpTotalRecorded = 0;
      state.httpEvictedCount = 0;
      state.httpTruncated = false;
      state.realtimeOrder = [];
      state.realtimeRecords.clear();
      state.realtimeTotalRecorded = 0;
      state.realtimeEvictedCount = 0;
      state.realtimeTruncated = false;
      state.recordingMetadata = {
        enabledInspectors: {
          ...state.recordingMetadata.enabledInspectors,
          ...metadata?.enabledInspectors,
        },
      };
      return getStatus();
    },

    stopRecording() {
      if (!state.isRecording) {
        throw new Error('No active network recording for this plugin session');
      }

      state.isRecording = false;
      state.stoppedAt = Date.now();
      return getStatus();
    },

    getStatus,

    getHttpRecord(requestId: string) {
      return state.httpRecords.get(requestId) || null;
    },

    getRealtimeRecord(requestId: string) {
      return state.realtimeRecords.get(requestId) || null;
    },

    listRequests(input: { limit?: number; cursor?: string }) {
      const limit = getLimit(input.limit);
      const rows = state.httpOrder
        .map((requestId) => state.httpRecords.get(requestId))
        .filter((record): record is HttpAgentRecord => !!record)
        .reverse()
        .map(createHttpSummary);
      return {
        ...getStatus(),
        ...paginate(rows, `http-${state.generation}`, limit, input.cursor),
      };
    },

    listRealtimeConnections(input: { limit?: number; cursor?: string }) {
      const limit = getLimit(input.limit);
      const rows = state.realtimeOrder
        .map((requestId) => state.realtimeRecords.get(requestId))
        .filter((record): record is RealtimeAgentRecord => !!record)
        .reverse()
        .map(getRealtimeSummary);
      return {
        ...getStatus(),
        ...paginate(rows, `realtime-${state.generation}`, limit, input.cursor),
      };
    },

    getRequestDetails(requestId: string) {
      const record = state.httpRecords.get(requestId);
      if (!record) {
        throw new Error(`Unknown request "${requestId}"`);
      }

      return {
        ...getStatus(),
        request: {
          requestId: record.requestId,
          method: record.request.method,
          url: record.request.url,
          type: record.resourceType,
          initiator: record.initiator,
          startTimeMs: record.startTimeMs,
          endTimeMs: record.endTimeMs ?? null,
          durationMs: record.durationMs ?? null,
          request: record.request,
          response: record.response ?? null,
          loadingFinished: record.status === 'finished',
          loadingFailed: record.status === 'failed',
          failureText: record.error ?? null,
          canceled: record.canceled ?? false,
          progress: record.progress
            ? {
                loaded: record.progress.loaded,
                total: record.progress.total,
                lengthComputable: record.progress.lengthComputable,
              }
            : null,
          ttfb: record.ttfb ?? null,
          size: record.size ?? null,
        },
      };
    },

    getRealtimeConnectionDetails(requestId: string) {
      const record = state.realtimeRecords.get(requestId);
      if (!record) {
        throw new Error(`Unknown realtime connection "${requestId}"`);
      }

      return {
        ...getStatus(),
        connection:
          record.kind === 'websocket'
            ? {
                requestId: record.requestId,
                kind: record.kind,
                url: record.url,
                socketId: record.socketId,
                status: record.status,
                startedAt: record.startedAt,
                endedAt: record.endedAt ?? null,
                durationMs: record.durationMs ?? null,
                protocols: record.protocols ?? null,
                options: record.options ?? [],
                error: record.error ?? null,
                closeCode: record.closeCode ?? null,
                closeReason: record.closeReason ?? null,
                messages: record.messages,
              }
            : {
                requestId: record.requestId,
                kind: record.kind,
                status: record.status,
                startedAt: record.startedAt,
                endedAt: record.endedAt ?? null,
                durationMs: record.durationMs ?? null,
                request: record.request ?? null,
                response: record.response ?? null,
                initiator: record.initiator ?? null,
                resourceType: record.resourceType ?? null,
                error: record.error ?? null,
                messages: record.messages,
              },
      };
    },

    getRequestBody(requestId: string): NetworkActivityAgentBodyResult {
      const record = state.httpRecords.get(requestId);
      if (!record) {
        throw new Error(`Unknown request "${requestId}"`);
      }

      return serializeRequestBody(requestId, record.request.postData);
    },

    onRequestSent(event: HttpEventMap['request-sent']) {
      if (!state.isRecording) {
        return;
      }

      const record = ensureHttpRecord(event.requestId, {
        request: event.request,
        resourceType: event.type,
        initiator: event.initiator,
        startTimeMs: event.timestamp,
        status: 'pending',
      });
      record.request = event.request;
      record.resourceType = event.type;
      record.initiator = event.initiator;
      record.startTimeMs = event.timestamp;
      record.status = 'pending';
      record.response = undefined;
      record.endTimeMs = undefined;
      record.durationMs = undefined;
      record.size = undefined;
      record.ttfb = undefined;
      record.error = undefined;
      record.canceled = undefined;
      record.progress = undefined;
    },

    onRequestProgress(event: HttpEventMap['request-progress']) {
      if (!state.isRecording) {
        return;
      }

      const record = ensureHttpRecord(event.requestId);
      record.progress = event;
      record.status = 'loading';
    },

    onResponseReceived(event: HttpEventMap['response-received']) {
      if (!state.isRecording) {
        return;
      }

      const record = ensureHttpRecord(event.requestId);
      record.response = event.response;
      record.status = 'loading';
    },

    onRequestCompleted(event: HttpEventMap['request-completed']) {
      if (!state.isRecording) {
        return;
      }

      const record = ensureHttpRecord(event.requestId);
      record.status = 'finished';
      record.endTimeMs = event.timestamp;
      record.durationMs = event.duration;
      record.size = event.size;
      record.ttfb = event.ttfb;
    },

    onRequestFailed(event: HttpEventMap['request-failed']) {
      if (!state.isRecording) {
        return;
      }

      const record = ensureHttpRecord(event.requestId);
      record.status = 'failed';
      record.endTimeMs = event.timestamp;
      record.error = event.error;
      record.canceled = event.canceled;
    },

    onWebSocketConnect(event: WebSocketEventMap['websocket-connect']) {
      if (!state.isRecording) {
        return;
      }

      ensureRealtimeRecord(`ws-${event.socketId}`, () => ({
        requestId: `ws-${event.socketId}`,
        kind: 'websocket',
        url: event.url,
        socketId: event.socketId,
        status: 'connecting',
        startedAt: event.timestamp,
        protocols: event.protocols,
        options: event.options,
        messages: [],
      }));
    },

    onWebSocketOpen(event: WebSocketEventMap['websocket-open']) {
      if (!state.isRecording) {
        return;
      }

      const record = ensureRealtimeRecord(`ws-${event.socketId}`, () => ({
        requestId: `ws-${event.socketId}`,
        kind: 'websocket',
        url: event.url,
        socketId: event.socketId,
        status: 'connecting',
        startedAt: event.timestamp,
        messages: [],
      })) as WebSocketAgentRecord;
      record.status = 'open';
    },

    onWebSocketClose(event: WebSocketEventMap['websocket-close']) {
      if (!state.isRecording) {
        return;
      }

      const record = ensureRealtimeRecord(`ws-${event.socketId}`, () => ({
        requestId: `ws-${event.socketId}`,
        kind: 'websocket',
        url: event.url,
        socketId: event.socketId,
        status: 'connecting',
        startedAt: event.timestamp,
        messages: [],
      })) as WebSocketAgentRecord;
      record.status = 'closed';
      record.endedAt = event.timestamp;
      record.durationMs = event.timestamp - record.startedAt;
      record.closeCode = event.code;
      record.closeReason = event.reason;
    },

    onWebSocketMessageSent(event: WebSocketEventMap['websocket-message-sent']) {
      if (!state.isRecording) {
        return;
      }

      const record = ensureRealtimeRecord(`ws-${event.socketId}`, () => ({
        requestId: `ws-${event.socketId}`,
        kind: 'websocket',
        url: event.url,
        socketId: event.socketId,
        status: 'connecting',
        startedAt: event.timestamp,
        messages: [],
      })) as WebSocketAgentRecord;
      const message: WebSocketAgentMessage = {
        id: nextMessageId(record.requestId),
        direction: 'sent',
        data: event.data,
        messageType: event.messageType,
        timestamp: event.timestamp,
      };
      record.messages = [...record.messages, message].slice(
        -MAX_WEBSOCKET_MESSAGES_PER_CONNECTION,
      );
    },

    onWebSocketMessageReceived(
      event: WebSocketEventMap['websocket-message-received'],
    ) {
      if (!state.isRecording) {
        return;
      }

      const record = ensureRealtimeRecord(`ws-${event.socketId}`, () => ({
        requestId: `ws-${event.socketId}`,
        kind: 'websocket',
        url: event.url,
        socketId: event.socketId,
        status: 'connecting',
        startedAt: event.timestamp,
        messages: [],
      })) as WebSocketAgentRecord;
      const message: WebSocketAgentMessage = {
        id: nextMessageId(record.requestId),
        direction: 'received',
        data: event.data,
        messageType: event.messageType,
        timestamp: event.timestamp,
      };
      record.messages = [...record.messages, message].slice(
        -MAX_WEBSOCKET_MESSAGES_PER_CONNECTION,
      );
    },

    onWebSocketError(event: WebSocketEventMap['websocket-error']) {
      if (!state.isRecording) {
        return;
      }

      const record = ensureRealtimeRecord(`ws-${event.socketId}`, () => ({
        requestId: `ws-${event.socketId}`,
        kind: 'websocket',
        url: event.url,
        socketId: event.socketId,
        status: 'connecting',
        startedAt: event.timestamp,
        messages: [],
      })) as WebSocketAgentRecord;
      record.status = 'error';
      record.error = event.error;
    },

    onWebSocketConnectionStatusChanged(
      event: WebSocketEventMap['websocket-connection-status-changed'],
    ) {
      if (!state.isRecording) {
        return;
      }

      const record = ensureRealtimeRecord(`ws-${event.socketId}`, () => ({
        requestId: `ws-${event.socketId}`,
        kind: 'websocket',
        url: event.url,
        socketId: event.socketId,
        status: 'connecting',
        startedAt: event.timestamp,
        messages: [],
      })) as WebSocketAgentRecord;
      record.status = event.status;
    },

    onSSEOpen(event: SSEEventMap['sse-open']) {
      if (!state.isRecording) {
        return;
      }

      const httpRecord = state.httpRecords.get(event.requestId);
      ensureRealtimeRecord(event.requestId, () => ({
        requestId: event.requestId,
        kind: 'sse',
        status: 'open',
        startedAt: httpRecord?.startTimeMs ?? event.timestamp,
        request: httpRecord?.request,
        response: event.response,
        initiator: httpRecord?.initiator,
        resourceType: httpRecord?.resourceType,
        messages: [],
      }));
    },

    onSSEMessage(event: SSEEventMap['sse-message']) {
      if (!state.isRecording) {
        return;
      }

      const record = ensureRealtimeRecord(event.requestId, () => ({
        requestId: event.requestId,
        kind: 'sse',
        status: 'connecting',
        startedAt: event.timestamp,
        messages: [],
      })) as SSEAgentRecord;
      record.messages = [
        ...record.messages,
        {
          id: nextMessageId(record.requestId),
          type: event.payload.type,
          data: event.payload.data,
          timestamp: event.timestamp,
        },
      ].slice(-MAX_SSE_MESSAGES_PER_CONNECTION);
    },

    onSSEError(event: SSEEventMap['sse-error']) {
      if (!state.isRecording) {
        return;
      }

      const record = ensureRealtimeRecord(event.requestId, () => ({
        requestId: event.requestId,
        kind: 'sse',
        status: 'connecting',
        startedAt: event.timestamp,
        messages: [],
      })) as SSEAgentRecord;
      record.status = 'error';
      record.error = event.error.message;
    },

    onSSEClose(event: SSEEventMap['sse-close']) {
      if (!state.isRecording) {
        return;
      }

      const record = ensureRealtimeRecord(event.requestId, () => ({
        requestId: event.requestId,
        kind: 'sse',
        status: 'connecting',
        startedAt: event.timestamp,
        messages: [],
      })) as SSEAgentRecord;
      record.status = 'closed';
      record.endedAt = event.timestamp;
      record.durationMs = event.timestamp - record.startedAt;
    },
  };
};

export type NetworkActivityAgentState = ReturnType<
  typeof createNetworkActivityAgentState
>;

export const getNetworkActivityAgentState = (() => {
  let instance: NetworkActivityAgentState | null = null;

  return () => {
    if (!instance) {
      instance = createNetworkActivityAgentState();
    }

    return instance;
  };
})();
