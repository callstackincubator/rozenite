import type { JSONSchema7, AgentTool } from './types.js';
import { createArtifactFileWriter } from './artifact-file.js';
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  paginateRows,
} from './output-shaping.js';

type CDPCommandSender = (
  method: string,
  params?: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

type CDPEventListener = (params: Record<string, unknown>) => void | Promise<void>;
type SubscribeToCDPEvent = (method: string, listener: CDPEventListener) => () => void;

type SessionInfoReader = () => {
  sessionId: string;
  pageId: string;
  deviceId: string;
};

type TraceState = {
  startedAt: number;
  categories?: string[];
  options?: string;
};

type SamplingState = {
  startedAt: number;
  samplingInterval?: number;
  includeObjectsCollectedByMajorGC?: boolean;
  includeObjectsCollectedByMinorGC?: boolean;
};

type NetworkRequestRecord = {
  requestId: string;
  sequence: number;
  url?: string;
  method?: string;
  type?: string;
  startTimeMs?: number;
  wallTimeMs?: number;
  endTimeMs?: number;
  durationMs?: number;
  status?: number;
  statusText?: string;
  mimeType?: string;
  protocol?: string;
  remoteIPAddress?: string;
  remotePort?: number;
  fromDiskCache?: boolean;
  fromMemoryCache?: boolean;
  fromPrefetchCache?: boolean;
  encodedDataLength?: number;
  transferSize?: number;
  initiator?: unknown;
  priority?: string;
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, unknown>;
    mixedContentType?: string;
    initialPriority?: string;
    referrerPolicy?: string;
    isSameSite?: boolean;
    postDataEntries?: unknown[];
    hasPostData?: boolean;
  };
  response?: {
    url?: string;
    status?: number;
    statusText?: string;
    headers?: Record<string, unknown>;
    mimeType?: string;
    protocol?: string;
    securityState?: string;
    connectionReused?: boolean;
    connectionId?: number;
    encodedDataLength?: number;
    fromDiskCache?: boolean;
    fromServiceWorker?: boolean;
    fromPrefetchCache?: boolean;
    timing?: unknown;
    responseTime?: number;
    cacheStorageCacheName?: string;
  };
  requestHeadersExtra?: Record<string, unknown>;
  requestAssociatedCookies?: unknown[];
  responseHeadersExtra?: Record<string, unknown>;
  responseBlockedCookies?: unknown[];
  redirectChain?: Array<{
    url?: string;
    status?: number;
    statusText?: string;
  }>;
  servedFromCache?: boolean;
  loadingFinished?: boolean;
  loadingFailed?: boolean;
  failureText?: string;
  blockedReason?: string;
  corsErrorStatus?: unknown;
};

type NetworkRecordingState = {
  isRecording: boolean;
  startedAt?: number;
  stoppedAt?: number;
  requestOrder: string[];
  requests: Map<string, NetworkRequestRecord>;
  totalRecorded: number;
  evictedCount: number;
  truncated: boolean;
  generation: number;
  unsubscribers: Array<() => void>;
  enabled: boolean;
};

type NetworkBodyResult = {
  requestId: string;
  available: boolean;
  body?: string;
  base64Encoded?: boolean;
  decoded?: boolean;
  mimeType?: string;
  reason?: string;
};

const DEFAULT_RN_DEVTOOLS_TRACE_CATEGORIES = [
  '-*',
  'blink.console',
  'loading',
  'blink.user_timing',
  'devtools.timeline',
  'disabled-by-default-devtools.target-rundown',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-devtools.timeline.stack',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.v8-source-rundown',
  'disabled-by-default-v8.compile',
  'disabled-by-default-v8.inspector',
  'disabled-by-default-v8.cpu_profiler.hires',
  'disabled-by-default-lighthouse',
  'v8.execute',
  'v8',
  'cppgc',
  'navigation',
  'rail',
  'disabled-by-default-v8.cpu_profiler',
] as const;

export type LocalAgentToolService = {
  getTools: () => AgentTool[];
  callTool: (toolName: string, args: unknown) => Promise<unknown | undefined>;
  onDisconnected: () => void;
  dispose: () => Promise<void>;
};

const FILE_PATH_SCHEMA: JSONSchema7 = {
  type: 'string',
  description: 'Destination file path on the local machine.',
};

const NETWORK_BUFFER_CAPACITY = 500;

const getRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const getString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const getOptionalStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter((item): item is string => typeof item === 'string');
  return items.length > 0 ? items : undefined;
};

const getOptionalNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const getOptionalBoolean = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined;
};

const getOptionalPositiveInteger = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return undefined;
  }

  return value;
};

const getOptionalRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
};

const toMilliseconds = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.round(value * 1000);
};

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const isTextLikeMimeType = (mimeType: string | undefined): boolean => {
  if (!mimeType) {
    return false;
  }

  const normalized = mimeType.split(';', 1)[0]?.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized.startsWith('text/')
    || normalized === 'application/json'
    || normalized === 'application/javascript'
    || normalized === 'application/xml'
    || normalized === 'application/x-www-form-urlencoded'
    || normalized === 'application/graphql'
    || normalized.endsWith('+json')
    || normalized.endsWith('+xml');
};

const createNetworkSummary = (record: NetworkRequestRecord) => ({
  requestId: record.requestId,
  method: record.method || record.request?.method || 'UNKNOWN',
  url: record.url || record.request?.url || '',
  status: record.status ?? record.response?.status ?? null,
  type: record.type ?? null,
  startTimeMs: record.startTimeMs ?? null,
  endTimeMs: record.endTimeMs ?? null,
  durationMs: record.durationMs ?? null,
  transferSize: record.transferSize ?? null,
  encodedDataLength: record.encodedDataLength ?? record.response?.encodedDataLength ?? null,
  outcome: record.loadingFailed
    ? 'failed'
    : record.loadingFinished
      ? 'success'
      : 'in-flight',
});

const createNetworkStatus = (
  sessionInfo: ReturnType<SessionInfoReader>,
  state: NetworkRecordingState,
) => ({
  session: {
    id: sessionInfo.sessionId,
    deviceId: sessionInfo.deviceId,
    pageId: sessionInfo.pageId,
  },
  recording: {
    isRecording: state.isRecording,
    startedAt: state.startedAt ?? null,
    stoppedAt: state.stoppedAt ?? null,
    requestCount: state.requestOrder.length,
    totalRecorded: state.totalRecorded,
    evictedCount: state.evictedCount,
    truncated: state.truncated,
    capacity: NETWORK_BUFFER_CAPACITY,
    generation: state.generation,
  },
});

const getCDPCommandResult = (value: Record<string, unknown>): Record<string, unknown> => {
  return getOptionalRecord(value.result) || value;
};

const createCDPEventWaiter = (
  subscribeToCDPEvent: SubscribeToCDPEvent,
  method: string,
): {
  promise: Promise<Record<string, unknown>>;
  cancel: () => void;
} => {
  let unsubscribe = () => {};
  const promise = new Promise<Record<string, unknown>>((resolve) => {
    unsubscribe = subscribeToCDPEvent(method, (params) => {
      unsubscribe();
      resolve(params);
    });
  });

  return {
    promise,
    cancel: () => unsubscribe(),
  };
};

const createTraceResult = (
  sessionInfo: ReturnType<SessionInfoReader>,
  startedAt: number,
  artifact: { path: string; bytes: number },
): {
  artifact: { type: 'trace'; path: string; bytes: number };
  session: { id: string; deviceId: string; pageId: string };
  timing: { startedAt: number; finishedAt: number; durationMs: number };
} => {
  const finishedAt = Date.now();
  return {
  artifact: {
    type: 'trace',
    path: artifact.path,
    bytes: artifact.bytes,
  },
  session: {
    id: sessionInfo.sessionId,
    deviceId: sessionInfo.deviceId,
    pageId: sessionInfo.pageId,
  },
  timing: {
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
  },
  };
};

const createTraceMetadata = (
  startedAt: number,
  traceWindow: { min: number; max: number } | null,
) => {
  const window = traceWindow
    ? {
        min: traceWindow.min,
        max: traceWindow.max,
        range: traceWindow.max - traceWindow.min,
      }
    : {
        min: 0,
        max: 0,
        range: 0,
      };

  return {
    source: 'DevTools',
    startTime: new Date(startedAt).toISOString(),
    dataOrigin: 'TraceEvents',
    modifications: {
      entriesModifications: {
        hiddenEntries: [],
        expandableEntries: [],
      },
      initialBreadcrumb: {
        window,
        child: null,
      },
      annotations: {
        entryLabels: [],
        labelledTimeRanges: [],
        linksBetweenEntries: [],
      },
    },
  };
};

const createProfileResult = (
  type: 'sampling-profile' | 'heap-snapshot',
  sessionInfo: ReturnType<SessionInfoReader>,
  startedAt: number,
  artifact: { path: string; bytes: number },
): {
  artifact: { type: 'sampling-profile' | 'heap-snapshot'; path: string; bytes: number };
  session: { id: string; deviceId: string; pageId: string };
  timing: { startedAt: number; finishedAt: number; durationMs: number };
} => {
  const finishedAt = Date.now();
  return {
  artifact: {
    type,
    path: artifact.path,
    bytes: artifact.bytes,
  },
  session: {
    id: sessionInfo.sessionId,
    deviceId: sessionInfo.deviceId,
    pageId: sessionInfo.pageId,
  },
  timing: {
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
  },
  };
};

export const createPerformanceDomainService = (deps: {
  getSessionInfo: SessionInfoReader;
  sendCommand: CDPCommandSender;
  subscribeToCDPEvent: SubscribeToCDPEvent;
}): LocalAgentToolService => {
  const tools: AgentTool[] = [
    {
      name: 'startTrace',
      description: 'Start a CDP performance trace for the current session target.',
      inputSchema: {
        type: 'object',
        properties: {
          categories: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional trace categories. Passed to Tracing.start.',
          },
          options: {
            type: 'string',
            description: 'Optional trace options string. Passed to Tracing.start.',
          },
        },
      },
    },
    {
      name: 'stopTrace',
      description: 'Stop the active trace and write the result to filePath.',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: FILE_PATH_SCHEMA,
        },
        required: ['filePath'],
      },
    },
  ];

  let traceState: TraceState | null = null;

  const startTrace = async (args: unknown) => {
    if (traceState) {
      throw new Error('A trace is already active for this session');
    }

    const input = getRecord(args);
    const categories = getOptionalStringArray(input.categories)
      || [...DEFAULT_RN_DEVTOOLS_TRACE_CATEGORIES];
    const options = getString(input.options);

    await deps.sendCommand('Tracing.start', {
      transferMode: 'ReportEvents',
      bufferUsageReportingInterval: 500,
      categories: categories.join(','),
      ...(options ? { options } : {}),
    });

    traceState = {
      startedAt: Date.now(),
      categories,
      ...(options ? { options } : {}),
    };

    return {
      started: true,
      session: deps.getSessionInfo(),
      trace: traceState,
    };
  };

  const stopTrace = async (args: unknown) => {
    if (!traceState) {
      throw new Error('No active trace for this session');
    }

    const input = getRecord(args);
    const filePath = getString(input.filePath);
    if (!filePath) {
      throw new Error('"filePath" is required');
    }

    const startedAt = traceState.startedAt;
    const writer = await createArtifactFileWriter(filePath);
    let pendingWrites = Promise.resolve();
    let wroteHeader = false;
    let isFirstEvent = true;
    let traceWindow: { min: number; max: number } | null = null;
    const tracingComplete = createCDPEventWaiter(
      deps.subscribeToCDPEvent,
      'Tracing.tracingComplete',
    );
    const unsubscribeDataCollected = deps.subscribeToCDPEvent(
      'Tracing.dataCollected',
      (params) => {
        const values = Array.isArray(params.value) ? params.value : [];
        pendingWrites = pendingWrites.then(async () => {
          if (!wroteHeader) {
            await writer.write('{"traceEvents":[');
            wroteHeader = true;
          }

          for (const item of values) {
            if (typeof item?.ts === 'number' && Number.isFinite(item.ts)) {
              traceWindow = traceWindow
                ? {
                    min: Math.min(traceWindow.min, item.ts),
                    max: Math.max(traceWindow.max, item.ts),
                  }
                : { min: item.ts, max: item.ts };
            }
            if (!isFirstEvent) {
              await writer.write(',');
            }
            await writer.write(JSON.stringify(item));
            isFirstEvent = false;
          }
        });
      },
    );

    try {
      await deps.sendCommand('Tracing.end');
      await tracingComplete.promise;
      await pendingWrites;
      if (!wroteHeader) {
        await writer.write('{"traceEvents":[');
      }
      await writer.write(`],"metadata":${JSON.stringify(createTraceMetadata(startedAt, traceWindow))}}`);
      const artifact = await writer.finalize();
      return createTraceResult(deps.getSessionInfo(), startedAt, artifact);
    } catch (error) {
      await writer.abort();
      throw error;
    } finally {
      unsubscribeDataCollected();
      tracingComplete.cancel();
      traceState = null;
    }
  };

  return {
    getTools: () => tools,
    callTool: async (toolName, args) => {
      if (toolName === 'startTrace') {
        return await startTrace(args);
      }
      if (toolName === 'stopTrace') {
        return await stopTrace(args);
      }
      return undefined;
    },
    onDisconnected: () => {
      traceState = null;
    },
    dispose: async () => {
      traceState = null;
    },
  };
};

export const createMemoryDomainService = (deps: {
  getSessionInfo: SessionInfoReader;
  sendCommand: CDPCommandSender;
  subscribeToCDPEvent: SubscribeToCDPEvent;
}): LocalAgentToolService => {
  const tools: AgentTool[] = [
    {
      name: 'takeHeapSnapshot',
      description: 'Capture a heap snapshot and write it to filePath.',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: FILE_PATH_SCHEMA,
        },
        required: ['filePath'],
      },
    },
    {
      name: 'startSampling',
      description: 'Start heap allocation sampling for the current session target.',
      inputSchema: {
        type: 'object',
        properties: {
          samplingInterval: {
            type: 'number',
            description: 'Average sampling interval in bytes.',
          },
          includeObjectsCollectedByMajorGC: {
            type: 'boolean',
            description: 'Include objects collected by major GC.',
          },
          includeObjectsCollectedByMinorGC: {
            type: 'boolean',
            description: 'Include objects collected by minor GC.',
          },
        },
      },
    },
    {
      name: 'stopSampling',
      description: 'Stop heap allocation sampling and write the profile to filePath.',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: FILE_PATH_SCHEMA,
        },
        required: ['filePath'],
      },
    },
  ];

  let samplingState: SamplingState | null = null;
  let heapSnapshotInProgress = false;

  const takeHeapSnapshot = async (args: unknown) => {
    if (heapSnapshotInProgress) {
      throw new Error('A heap snapshot is already in progress for this session');
    }

    const input = getRecord(args);
    const filePath = getString(input.filePath);
    if (!filePath) {
      throw new Error('"filePath" is required');
    }

    const startedAt = Date.now();
    const writer = await createArtifactFileWriter(filePath);
    heapSnapshotInProgress = true;

    let reportCompleted = false;
    const chunkUnsubscribe = deps.subscribeToCDPEvent(
      'HeapProfiler.addHeapSnapshotChunk',
      async (params) => {
        const chunk = getString(params.chunk);
        if (chunk) {
          await writer.write(chunk);
        }
      },
    );
    let unsubscribeProgress = () => {};
    const progressPromise = new Promise<void>((resolve) => {
      unsubscribeProgress = deps.subscribeToCDPEvent(
        'HeapProfiler.reportHeapSnapshotProgress',
        (params) => {
          if (params.finished === true) {
            reportCompleted = true;
            unsubscribeProgress();
            resolve();
          }
        },
      );
    });

    try {
      await deps.sendCommand('HeapProfiler.takeHeapSnapshot', {
        reportProgress: true,
      });
      if (!reportCompleted) {
        await progressPromise;
      }

      const artifact = await writer.finalize();
      return createProfileResult(
        'heap-snapshot',
        deps.getSessionInfo(),
        startedAt,
        artifact,
      );
    } catch (error) {
      await writer.abort();
      throw error;
    } finally {
      chunkUnsubscribe();
      unsubscribeProgress();
      heapSnapshotInProgress = false;
    }
  };

  const startSampling = async (args: unknown) => {
    if (samplingState) {
      throw new Error('Heap sampling is already active for this session');
    }

    const input = getRecord(args);
    const samplingInterval = getOptionalNumber(input.samplingInterval);
    const includeObjectsCollectedByMajorGC = getOptionalBoolean(
      input.includeObjectsCollectedByMajorGC,
    );
    const includeObjectsCollectedByMinorGC = getOptionalBoolean(
      input.includeObjectsCollectedByMinorGC,
    );

    await deps.sendCommand('HeapProfiler.startSampling', {
      ...(samplingInterval !== undefined ? { samplingInterval } : {}),
      ...(includeObjectsCollectedByMajorGC !== undefined
        ? { includeObjectsCollectedByMajorGC }
        : {}),
      ...(includeObjectsCollectedByMinorGC !== undefined
        ? { includeObjectsCollectedByMinorGC }
        : {}),
    });

    samplingState = {
      startedAt: Date.now(),
      ...(samplingInterval !== undefined ? { samplingInterval } : {}),
      ...(includeObjectsCollectedByMajorGC !== undefined
        ? { includeObjectsCollectedByMajorGC }
        : {}),
      ...(includeObjectsCollectedByMinorGC !== undefined
        ? { includeObjectsCollectedByMinorGC }
        : {}),
    };

    return {
      started: true,
      session: deps.getSessionInfo(),
      sampling: samplingState,
    };
  };

  const stopSampling = async (args: unknown) => {
    if (!samplingState) {
      throw new Error('No active heap sampling session');
    }

    const input = getRecord(args);
    const filePath = getString(input.filePath);
    if (!filePath) {
      throw new Error('"filePath" is required');
    }

    const startedAt = samplingState.startedAt;
    const writer = await createArtifactFileWriter(filePath);

    try {
      const result = await deps.sendCommand('HeapProfiler.stopSampling');
      await writer.write(JSON.stringify(result.profile ?? {}, null, 2));
      const artifact = await writer.finalize();
      return createProfileResult(
        'sampling-profile',
        deps.getSessionInfo(),
        startedAt,
        artifact,
      );
    } catch (error) {
      await writer.abort();
      throw error;
    } finally {
      samplingState = null;
    }
  };

  return {
    getTools: () => tools,
    callTool: async (toolName, args) => {
      if (toolName === 'takeHeapSnapshot') {
        return await takeHeapSnapshot(args);
      }
      if (toolName === 'startSampling') {
        return await startSampling(args);
      }
      if (toolName === 'stopSampling') {
        return await stopSampling(args);
      }
      return undefined;
    },
    onDisconnected: () => {
      samplingState = null;
      heapSnapshotInProgress = false;
    },
    dispose: async () => {
      samplingState = null;
      heapSnapshotInProgress = false;
    },
  };
};

export const createNetworkDomainService = (deps: {
  getSessionInfo: SessionInfoReader;
  sendCommand: CDPCommandSender;
  subscribeToCDPEvent: SubscribeToCDPEvent;
}): LocalAgentToolService => {
  const tools: AgentTool[] = [
    {
      name: 'startRecording',
      description: 'Start recording raw CDP network activity for the current session target.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'stopRecording',
      description: 'Stop recording network activity without clearing the captured request buffer.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'getRecordingStatus',
      description: 'Return network recording state and buffer metadata for the current session.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'listRequests',
      description: 'List captured network request summaries with cursor pagination.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: `Maximum number of requests to return. Defaults to ${DEFAULT_PAGE_LIMIT}, max ${MAX_PAGE_LIMIT}.`,
          },
          cursor: {
            type: 'string',
            description: 'Opaque pagination cursor from a previous listRequests call.',
          },
        },
      },
    },
    {
      name: 'getRequestDetails',
      description: 'Return detailed metadata for a captured network request without bodies.',
      inputSchema: {
        type: 'object',
        properties: {
          requestId: {
            type: 'string',
            description: 'Captured CDP requestId to inspect.',
          },
        },
        required: ['requestId'],
      },
    },
    {
      name: 'getRequestBody',
      description: 'Fetch the request body for a captured network request when supported by the target.',
      inputSchema: {
        type: 'object',
        properties: {
          requestId: {
            type: 'string',
            description: 'Captured CDP requestId to inspect.',
          },
        },
        required: ['requestId'],
      },
    },
    {
      name: 'getResponseBody',
      description: 'Fetch the response body for a captured network request when supported by the target.',
      inputSchema: {
        type: 'object',
        properties: {
          requestId: {
            type: 'string',
            description: 'Captured CDP requestId to inspect.',
          },
        },
        required: ['requestId'],
      },
    },
  ];

  const state: NetworkRecordingState = {
    isRecording: false,
    requestOrder: [],
    requests: new Map(),
    totalRecorded: 0,
    evictedCount: 0,
    truncated: false,
    generation: 0,
    unsubscribers: [],
    enabled: false,
  };

  const resetCapture = () => {
    state.requestOrder = [];
    state.requests.clear();
    state.totalRecorded = 0;
    state.evictedCount = 0;
    state.truncated = false;
    state.startedAt = undefined;
    state.stoppedAt = undefined;
    state.generation += 1;
  };

  const clearSubscriptions = () => {
    const unsubscribers = state.unsubscribers.splice(0);
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };

  const updateTiming = (record: NetworkRequestRecord) => {
    if (record.startTimeMs !== undefined && record.endTimeMs !== undefined) {
      record.durationMs = record.endTimeMs - record.startTimeMs;
    }
  };

  const evictOldestIfNeeded = () => {
    while (state.requestOrder.length > NETWORK_BUFFER_CAPACITY) {
      const oldestRequestId = state.requestOrder.shift();
      if (!oldestRequestId) {
        return;
      }

      state.requests.delete(oldestRequestId);
      state.evictedCount += 1;
      state.truncated = true;
    }
  };

  const ensureRecord = (requestId: string): NetworkRequestRecord => {
    const existing = state.requests.get(requestId);
    if (existing) {
      return existing;
    }

    const record: NetworkRequestRecord = {
      requestId,
      sequence: state.totalRecorded + 1,
    };
    state.requests.set(requestId, record);
    state.requestOrder.push(requestId);
    state.totalRecorded += 1;
    evictOldestIfNeeded();
    return record;
  };

  const getRecordById = (requestId: string): NetworkRequestRecord => {
    const record = state.requests.get(requestId);
    if (!record) {
      throw new Error(`Unknown request "${requestId}"`);
    }

    return record;
  };

  const subscribeRecordingEvents = () => {
    clearSubscriptions();

    state.unsubscribers.push(
      deps.subscribeToCDPEvent('Network.requestWillBeSent', (params) => {
        const requestId = getString(params.requestId);
        if (!requestId) {
          return;
        }

        const record = ensureRecord(requestId);
        const request = getOptionalRecord(params.request);
        const redirectResponse = getOptionalRecord(params.redirectResponse);

        if (redirectResponse) {
          const redirectChain = record.redirectChain || [];
          redirectChain.push({
            url: getString(redirectResponse.url),
            status: typeof redirectResponse.status === 'number' ? redirectResponse.status : undefined,
            statusText: getString(redirectResponse.statusText),
          });
          record.redirectChain = redirectChain;
        }

        record.url = getString(request?.url) || getString(params.documentURL) || record.url;
        record.method = getString(request?.method) || record.method;
        record.type = getString(params.type) || record.type;
        record.startTimeMs = toMilliseconds(params.timestamp) ?? record.startTimeMs;
        record.wallTimeMs = toMilliseconds(params.wallTime) ?? record.wallTimeMs;
        record.initiator = params.initiator ?? record.initiator;
        record.priority = getString(request?.initialPriority) || record.priority;
        record.request = {
          url: getString(request?.url),
          method: getString(request?.method),
          headers: getOptionalRecord(request?.headers),
          mixedContentType: getString(request?.mixedContentType),
          initialPriority: getString(request?.initialPriority),
          referrerPolicy: getString(request?.referrerPolicy),
          isSameSite: getOptionalBoolean(request?.isSameSite),
          postDataEntries: Array.isArray(request?.postDataEntries) ? request?.postDataEntries : undefined,
          hasPostData: request ? Boolean(request.hasPostData) : record.request?.hasPostData,
        };
      }),
      deps.subscribeToCDPEvent('Network.requestWillBeSentExtraInfo', (params) => {
        const requestId = getString(params.requestId);
        if (!requestId) {
          return;
        }

        const record = ensureRecord(requestId);
        record.requestHeadersExtra = getOptionalRecord(params.headers) || record.requestHeadersExtra;
        record.requestAssociatedCookies = Array.isArray(params.associatedCookies)
          ? params.associatedCookies
          : record.requestAssociatedCookies;
      }),
      deps.subscribeToCDPEvent('Network.responseReceived', (params) => {
        const requestId = getString(params.requestId);
        if (!requestId) {
          return;
        }

        const record = ensureRecord(requestId);
        const response = getOptionalRecord(params.response);

        record.type = getString(params.type) || record.type;
        record.status = typeof response?.status === 'number' ? response.status : record.status;
        record.statusText = getString(response?.statusText) || record.statusText;
        record.mimeType = getString(response?.mimeType) || record.mimeType;
        record.protocol = getString(response?.protocol) || record.protocol;
        record.remoteIPAddress = getString(response?.remoteIPAddress) || record.remoteIPAddress;
        record.remotePort = getOptionalNumber(response?.remotePort) || record.remotePort;
        record.fromDiskCache = getOptionalBoolean(response?.fromDiskCache) ?? record.fromDiskCache;
        record.fromMemoryCache = getOptionalBoolean(response?.fromMemoryCache) ?? record.fromMemoryCache;
        record.fromPrefetchCache = getOptionalBoolean(response?.fromPrefetchCache) ?? record.fromPrefetchCache;
        record.encodedDataLength = getOptionalNumber(response?.encodedDataLength) ?? record.encodedDataLength;
        record.response = {
          url: getString(response?.url),
          status: typeof response?.status === 'number' ? response.status : undefined,
          statusText: getString(response?.statusText),
          headers: getOptionalRecord(response?.headers),
          mimeType: getString(response?.mimeType),
          protocol: getString(response?.protocol),
          securityState: getString(response?.securityState),
          connectionReused: getOptionalBoolean(response?.connectionReused),
          connectionId: getOptionalNumber(response?.connectionId),
          encodedDataLength: getOptionalNumber(response?.encodedDataLength),
          fromDiskCache: getOptionalBoolean(response?.fromDiskCache),
          fromServiceWorker: getOptionalBoolean(response?.fromServiceWorker),
          fromPrefetchCache: getOptionalBoolean(response?.fromPrefetchCache),
          timing: response?.timing,
          responseTime: getOptionalNumber(response?.responseTime),
          cacheStorageCacheName: getString(response?.cacheStorageCacheName),
        };
      }),
      deps.subscribeToCDPEvent('Network.responseReceivedExtraInfo', (params) => {
        const requestId = getString(params.requestId);
        if (!requestId) {
          return;
        }

        const record = ensureRecord(requestId);
        record.responseHeadersExtra = getOptionalRecord(params.headers) || record.responseHeadersExtra;
        record.responseBlockedCookies = Array.isArray(params.blockedCookies)
          ? params.blockedCookies
          : record.responseBlockedCookies;
      }),
      deps.subscribeToCDPEvent('Network.requestServedFromCache', (params) => {
        const requestId = getString(params.requestId);
        if (!requestId) {
          return;
        }

        const record = ensureRecord(requestId);
        record.servedFromCache = true;
      }),
      deps.subscribeToCDPEvent('Network.loadingFinished', (params) => {
        const requestId = getString(params.requestId);
        if (!requestId) {
          return;
        }

        const record = ensureRecord(requestId);
        record.loadingFinished = true;
        record.loadingFailed = false;
        record.endTimeMs = toMilliseconds(params.timestamp) ?? record.endTimeMs;
        record.encodedDataLength = getOptionalNumber(params.encodedDataLength) ?? record.encodedDataLength;
        record.transferSize = getOptionalNumber(params.encodedDataLength) ?? record.transferSize;
        updateTiming(record);
      }),
      deps.subscribeToCDPEvent('Network.loadingFailed', (params) => {
        const requestId = getString(params.requestId);
        if (!requestId) {
          return;
        }

        const record = ensureRecord(requestId);
        record.loadingFinished = false;
        record.loadingFailed = true;
        record.endTimeMs = toMilliseconds(params.timestamp) ?? record.endTimeMs;
        record.failureText = getString(params.errorText) || record.failureText;
        record.blockedReason = getString(params.blockedReason) || record.blockedReason;
        record.corsErrorStatus = params.corsErrorStatus ?? record.corsErrorStatus;
        updateTiming(record);
      }),
    );
  };

  const startRecording = async () => {
    if (state.isRecording) {
      throw new Error('Network recording is already active for this session');
    }

    resetCapture();
    if (!state.enabled) {
      await deps.sendCommand('Network.enable');
      state.enabled = true;
    }

    state.isRecording = true;
    state.startedAt = Date.now();
    subscribeRecordingEvents();

    return {
      started: true,
      ...createNetworkStatus(deps.getSessionInfo(), state),
    };
  };

  const stopRecording = async () => {
    if (!state.isRecording) {
      throw new Error('No active network recording for this session');
    }

    clearSubscriptions();
    state.isRecording = false;
    state.stoppedAt = Date.now();

    return {
      stopped: true,
      ...createNetworkStatus(deps.getSessionInfo(), state),
    };
  };

  const getRecordingStatus = async () => {
    return createNetworkStatus(deps.getSessionInfo(), state);
  };

  const listRequests = async (args: unknown) => {
    const input = getRecord(args);
    const limit = Math.min(
      getOptionalPositiveInteger(input.limit) ?? DEFAULT_PAGE_LIMIT,
      MAX_PAGE_LIMIT,
    );
    const cursor = getString(input.cursor);
    const rows = state.requestOrder
      .map((requestId) => state.requests.get(requestId))
      .filter((record): record is NetworkRequestRecord => Boolean(record))
      .reverse()
      .map(createNetworkSummary);
    const page = paginateRows(rows, {
      kind: 'tools',
      scope: `network:requests:${state.generation}`,
      limit,
      cursor,
    });

    return {
      ...createNetworkStatus(deps.getSessionInfo(), state),
      items: page.items,
      page: page.page,
    };
  };

  const getRequestDetails = async (args: unknown) => {
    const input = getRecord(args);
    const requestId = getString(input.requestId);
    if (!requestId) {
      throw new Error('"requestId" is required');
    }

    const record = getRecordById(requestId);

    return {
      ...createNetworkStatus(deps.getSessionInfo(), state),
      request: {
        requestId: record.requestId,
        method: record.method || record.request?.method || null,
        url: record.url || record.request?.url || null,
        type: record.type ?? null,
        priority: record.priority ?? null,
        initiator: record.initiator ?? null,
        startTimeMs: record.startTimeMs ?? null,
        wallTimeMs: record.wallTimeMs ?? null,
        endTimeMs: record.endTimeMs ?? null,
        durationMs: record.durationMs ?? null,
        request: record.request ?? null,
        requestHeadersExtra: record.requestHeadersExtra ?? null,
        requestAssociatedCookies: record.requestAssociatedCookies ?? null,
        response: record.response ?? null,
        responseHeadersExtra: record.responseHeadersExtra ?? null,
        responseBlockedCookies: record.responseBlockedCookies ?? null,
        redirectChain: record.redirectChain ?? [],
        servedFromCache: record.servedFromCache ?? false,
        loadingFinished: record.loadingFinished ?? false,
        loadingFailed: record.loadingFailed ?? false,
        failureText: record.failureText ?? null,
        blockedReason: record.blockedReason ?? null,
        corsErrorStatus: record.corsErrorStatus ?? null,
      },
    };
  };

  const getRequestBody = async (args: unknown): Promise<NetworkBodyResult> => {
    const input = getRecord(args);
    const requestId = getString(input.requestId);
    if (!requestId) {
      throw new Error('"requestId" is required');
    }

    const record = getRecordById(requestId);
    if (!record.request?.hasPostData) {
      return {
        requestId,
        available: false,
        reason: 'No request body is available for this request.',
      };
    }

    try {
      const response = await deps.sendCommand('Network.getRequestPostData', { requestId });
      const result = getCDPCommandResult(response);
      const body = getString(result.postData);
      if (!body) {
        return {
          requestId,
          available: false,
          reason: 'The target returned no request body for this request.',
        };
      }

      return {
        requestId,
        available: true,
        body,
        base64Encoded: false,
      };
    } catch (error) {
      return {
        requestId,
        available: false,
        reason: getErrorMessage(error),
      };
    }
  };

  const getResponseBody = async (args: unknown): Promise<NetworkBodyResult> => {
    const input = getRecord(args);
    const requestId = getString(input.requestId);
    if (!requestId) {
      throw new Error('"requestId" is required');
    }

    const record = getRecordById(requestId);
    if (record.loadingFailed) {
      return {
        requestId,
        available: false,
        reason: 'Response body is unavailable because the request failed.',
      };
    }
    if (!record.loadingFinished) {
      return {
        requestId,
        available: false,
        reason: 'Response body is unavailable until the request finishes loading.',
      };
    }

    try {
      const response = await deps.sendCommand('Network.getResponseBody', { requestId });
      const result = getCDPCommandResult(response);
      const body = getString(result.body);
      const base64Encoded = getOptionalBoolean(result.base64Encoded) ?? false;
      const mimeType = record.response?.mimeType || record.mimeType;
      if (body === undefined) {
        return {
          requestId,
          available: false,
          reason: 'The target returned no response body for this request.',
        };
      }

      if (base64Encoded && isTextLikeMimeType(mimeType)) {
        try {
          return {
            requestId,
            available: true,
            body: Buffer.from(body, 'base64').toString('utf8'),
            base64Encoded: false,
            decoded: true,
            mimeType,
          };
        } catch (error) {
          return {
            requestId,
            available: false,
            reason: `Failed to decode base64 response body: ${getErrorMessage(error)}`,
          };
        }
      }

      return {
        requestId,
        available: true,
        body,
        base64Encoded,
        decoded: false,
        mimeType,
      };
    } catch (error) {
      return {
        requestId,
        available: false,
        reason: getErrorMessage(error),
      };
    }
  };

  return {
    getTools: () => tools,
    callTool: async (toolName, args) => {
      if (toolName === 'startRecording') {
        return await startRecording();
      }
      if (toolName === 'stopRecording') {
        return await stopRecording();
      }
      if (toolName === 'getRecordingStatus') {
        return await getRecordingStatus();
      }
      if (toolName === 'listRequests') {
        return await listRequests(args);
      }
      if (toolName === 'getRequestDetails') {
        return await getRequestDetails(args);
      }
      if (toolName === 'getRequestBody') {
        return await getRequestBody(args);
      }
      if (toolName === 'getResponseBody') {
        return await getResponseBody(args);
      }
      return undefined;
    },
    onDisconnected: () => {
      clearSubscriptions();
      state.isRecording = false;
      state.enabled = false;
    },
    dispose: async () => {
      clearSubscriptions();
      if (state.enabled) {
        try {
          await deps.sendCommand('Network.disable');
        } catch {}
      }
      state.isRecording = false;
      state.enabled = false;
    },
  };
};
