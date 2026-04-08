import type { JSONSchema7, AgentTool } from '@rozenite/agent-shared';
import { createReactTreeStore } from './runtime/react/store.js';
import type { ArtifactBucket, ArtifactFileWriter } from './artifacts.js';

type CDPCommandSender = (
  method: string,
  params?: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

type CDPEventListener = (
  params: Record<string, unknown>,
) => void | Promise<void>;
type SubscribeToCDPEvent = (
  method: string,
  listener: CDPEventListener,
) => () => void;

type SessionInfoReader = () => {
  sessionId: string;
  pageId: string;
  deviceId: string;
};

type ArtifactWriterFactory = (
  bucket: ArtifactBucket,
  extension: string,
  nameHint?: string,
) => Promise<ArtifactFileWriter>;

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
  captureReactDevToolsMessage?: (message: unknown) => Promise<void>;
  onDisconnected: () => void;
  dispose: () => Promise<void>;
};

const NAME_HINT_SCHEMA: JSONSchema7 = {
  type: 'string',
  description:
    'Optional file naming hint used for the Metro-managed artifact filename.',
};

const DEFAULT_DOMAIN_PAGE_LIMIT = 20;
const MAX_DOMAIN_PAGE_LIMIT = 100;
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

  const items = value.filter(
    (item): item is string => typeof item === 'string',
  );
  return items.length > 0 ? items : undefined;
};

const getOptionalNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
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

const getOptionalRecord = (
  value: unknown,
): Record<string, unknown> | undefined => {
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

  return (
    normalized.startsWith('text/') ||
    normalized === 'application/json' ||
    normalized === 'application/javascript' ||
    normalized === 'application/xml' ||
    normalized === 'application/x-www-form-urlencoded' ||
    normalized === 'application/graphql' ||
    normalized.endsWith('+json') ||
    normalized.endsWith('+xml')
  );
};

const paginateRows = <T>(
  rows: T[],
  options: {
    scope: string;
    limit: number;
    cursor?: string;
  },
): {
  items: T[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
} => {
  let startIndex = 0;
  if (options.cursor) {
    try {
      const decoded = JSON.parse(
        Buffer.from(options.cursor, 'base64url').toString('utf8'),
      ) as { v: 1; scope: string; index: number };
      if (
        decoded.v !== 1 ||
        decoded.scope !== options.scope ||
        !Number.isInteger(decoded.index) ||
        decoded.index < 0
      ) {
        throw new Error('Invalid cursor payload');
      }
      startIndex = decoded.index;
    } catch {
      throw new Error(
        'Invalid "cursor". Run the command again without cursor to restart pagination.',
      );
    }
  }

  const endIndex = Math.min(startIndex + options.limit, rows.length);
  const items = rows.slice(startIndex, endIndex);
  const hasMore = endIndex < rows.length;
  const nextCursor = hasMore
    ? Buffer.from(
        JSON.stringify({ v: 1, scope: options.scope, index: endIndex }),
        'utf8',
      ).toString('base64url')
    : undefined;

  return {
    items,
    page: {
      limit: options.limit,
      hasMore,
      ...(nextCursor ? { nextCursor } : {}),
    },
  };
};

const createArtifactMetadata = (
  artifact: {
    path: string;
    relativePath: string;
    bytes: number;
    bucket: ArtifactBucket;
    fileName: string;
  },
  type: 'trace' | 'sampling-profile' | 'heap-snapshot',
) => {
  return {
    type,
    path: artifact.path,
    relativePath: artifact.relativePath,
    bytes: artifact.bytes,
    bucket: artifact.bucket,
    fileName: artifact.fileName,
  };
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
  encodedDataLength:
    record.encodedDataLength ?? record.response?.encodedDataLength ?? null,
  outcome: record.loadingFailed
    ? 'failed'
    : record.loadingFinished
      ? 'success'
      : 'in-flight',
});

const createNetworkStatus = (state: NetworkRecordingState) => ({
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

const getCDPCommandResult = (
  value: Record<string, unknown>,
): Record<string, unknown> => {
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
  startedAt: number,
  artifact: {
    path: string;
    relativePath: string;
    bytes: number;
    bucket: ArtifactBucket;
    fileName: string;
  },
) => {
  const finishedAt = Date.now();
  return {
    artifact: createArtifactMetadata(artifact, 'trace'),
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
  startedAt: number,
  artifact: {
    path: string;
    relativePath: string;
    bytes: number;
    bucket: ArtifactBucket;
    fileName: string;
  },
) => {
  const finishedAt = Date.now();
  return {
    artifact: createArtifactMetadata(artifact, type),
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
  createArtifactWriter: ArtifactWriterFactory;
}): LocalAgentToolService => {
  const tools: AgentTool[] = [
    {
      name: 'startTrace',
      description:
        'Start a CDP performance trace for the current session target.',
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
            description:
              'Optional trace options string. Passed to Tracing.start.',
          },
        },
      },
    },
    {
      name: 'stopTrace',
      description:
        'Stop the active trace and write the result to a Metro-managed artifact path.',
      inputSchema: {
        type: 'object',
        properties: {
          nameHint: NAME_HINT_SCHEMA,
        },
      },
    },
  ];

  let traceState: TraceState | null = null;

  const startTrace = async (args: unknown) => {
    if (traceState) {
      throw new Error('A trace is already active for this session');
    }

    const input = getRecord(args);
    const categories = getOptionalStringArray(input.categories) || [
      ...DEFAULT_RN_DEVTOOLS_TRACE_CATEGORIES,
    ];
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
      trace: traceState,
    };
  };

  const stopTrace = async (args: unknown) => {
    if (!traceState) {
      throw new Error('No active trace for this session');
    }

    const input = getRecord(args);
    const startedAt = traceState.startedAt;
    const writer = await deps.createArtifactWriter(
      'traces',
      'json',
      getString(input.nameHint),
    );
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
      await writer.write(
        `],"metadata":${JSON.stringify(createTraceMetadata(startedAt, traceWindow))}}`,
      );
      const artifact = await writer.finalize();
      return createTraceResult(startedAt, artifact);
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
        return startTrace(args);
      }
      if (toolName === 'stopTrace') {
        return stopTrace(args);
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

export const createReactDomainService = (deps: {
  sessionId: string;
  sendReactDevToolsMessage: (message: {
    event: string;
    payload: unknown;
  }) => void;
}): LocalAgentToolService => {
  const tools: AgentTool[] = [
    {
      name: 'getNode',
      description: 'Get a single React node summary by ID.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: {
            type: 'integer',
            description: 'React DevTools node ID.',
          },
        },
        required: ['nodeId'],
      },
    },
    {
      name: 'getChildren',
      description: "Get a node's direct children with cursor-based pagination.",
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: {
            type: 'integer',
            description: 'Parent node ID.',
          },
          limit: {
            type: 'integer',
            description: 'Page size. Default 20, max 100.',
          },
          cursor: {
            type: 'string',
            description: 'Opaque cursor returned by the previous page.',
          },
        },
        required: ['nodeId'],
      },
    },
    {
      name: 'getProps',
      description:
        'Get inspected props for a node with cursor-based pagination.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: {
            type: 'integer',
            description: 'Node ID to read props for.',
          },
          limit: {
            type: 'integer',
            description: 'Page size. Default 20, max 100.',
          },
          cursor: {
            type: 'string',
            description: 'Opaque cursor returned by the previous page.',
          },
        },
        required: ['nodeId'],
      },
    },
    {
      name: 'getState',
      description:
        'Get inspected state for a node with cursor-based pagination.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: {
            type: 'integer',
            description: 'Node ID to read state for.',
          },
          limit: {
            type: 'integer',
            description: 'Page size. Default 20, max 100.',
          },
          cursor: {
            type: 'string',
            description: 'Opaque cursor returned by the previous page.',
          },
        },
        required: ['nodeId'],
      },
    },
    {
      name: 'getHooks',
      description:
        'Get inspected hooks for a node with cursor-based pagination.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: {
            type: 'integer',
            description: 'Node ID to read hooks for.',
          },
          path: {
            type: 'array',
            items: {
              oneOf: [{ type: 'string' }, { type: 'integer' }],
            },
            description: 'Optional path into hooks tree, e.g. [0, "subHooks"].',
          },
          limit: {
            type: 'integer',
            description: 'Page size. Default 20, max 100.',
          },
          cursor: {
            type: 'string',
            description: 'Opaque cursor returned by the previous page.',
          },
        },
        required: ['nodeId'],
      },
    },
    {
      name: 'searchNodes',
      description: 'Search React component tree nodes by display name or key.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query. Required and non-empty.',
          },
          rootId: {
            type: 'integer',
            description: 'Optional root node ID to scope search to a subtree.',
          },
          match: {
            type: 'string',
            enum: ['name', 'name-or-key'],
            description: 'Matching mode. Defaults to "name".',
          },
          limit: {
            type: 'integer',
            description: 'Page size. Default 20, max 100.',
          },
          cursor: {
            type: 'string',
            description: 'Opaque cursor returned by the previous page.',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'startProfiling',
      description:
        'Start React profiling or request reload-and-profile when supported.',
      inputSchema: {
        type: 'object',
        properties: {
          shouldRestart: {
            type: 'boolean',
            description:
              'If true, requests reload-and-profile instead of starting immediately.',
          },
        },
      },
    },
    {
      name: 'isProfilingStarted',
      description:
        'Get current React profiling status and recorded data availability.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'stopProfiling',
      description:
        'Stop React profiling and return a compact summary of the captured session.',
      inputSchema: {
        type: 'object',
        properties: {
          waitForDataMs: {
            type: 'number',
            description:
              'Max wait for backend profiling data processing. Default 3000ms, max 10000ms.',
          },
          slowRenderThresholdMs: {
            type: 'number',
            description:
              'Threshold used to classify slow commits. Default 16ms.',
          },
        },
      },
    },
    {
      name: 'getRenderData',
      description:
        'Get a paged summary of a single React commit by rootId and commitIndex.',
      inputSchema: {
        type: 'object',
        properties: {
          rootId: {
            type: 'integer',
            description: 'React root ID.',
          },
          commitIndex: {
            type: 'integer',
            description: 'Zero-based commit index within the selected root.',
          },
          limit: {
            type: 'integer',
            description: 'Page size. Default 20, max 100.',
          },
          cursor: {
            type: 'string',
            description: 'Opaque cursor returned by the previous page.',
          },
          sort: {
            type: 'string',
            enum: ['duration-desc', 'name-asc'],
            description: 'Sort order. Defaults to "duration-desc".',
          },
          slowRenderThresholdMs: {
            type: 'number',
            description:
              'Threshold used to classify slow fibers. Default 16ms.',
          },
        },
        required: ['rootId', 'commitIndex'],
      },
    },
  ];

  const sessionDeviceId = `react-session:${deps.sessionId}`;
  const store = createReactTreeStore();
  store.registerDevice(sessionDeviceId, {
    sendMessage: deps.sendReactDevToolsMessage,
  });

  return {
    getTools: () => tools,
    callTool: async (toolName, args) => {
      switch (toolName) {
        case 'getNode':
          return store.getNode(sessionDeviceId, args);
        case 'getChildren':
          return store.getChildren(sessionDeviceId, args);
        case 'getProps':
          return store.getProps(sessionDeviceId, args);
        case 'getState':
          return store.getState(sessionDeviceId, args);
        case 'getHooks':
          return store.getHooks(sessionDeviceId, args);
        case 'searchNodes':
          return store.searchNodes(sessionDeviceId, args);
        case 'startProfiling':
          return store.startProfiling(sessionDeviceId, args);
        case 'isProfilingStarted':
          return store.isProfilingStarted(sessionDeviceId);
        case 'stopProfiling':
          return store.stopProfiling(sessionDeviceId, args);
        case 'getRenderData':
          return store.getRenderData(sessionDeviceId, args);
        default:
          return undefined;
      }
    },
    captureReactDevToolsMessage: async (message) => {
      await store.ingestReactDevToolsMessage(sessionDeviceId, message);
    },
    onDisconnected: () => {
      store.unregisterDevice(sessionDeviceId);
    },
    dispose: async () => {
      store.unregisterDevice(sessionDeviceId);
    },
  };
};

export const createMemoryDomainService = (deps: {
  getSessionInfo: SessionInfoReader;
  sendCommand: CDPCommandSender;
  subscribeToCDPEvent: SubscribeToCDPEvent;
  createArtifactWriter: ArtifactWriterFactory;
}): LocalAgentToolService => {
  const tools: AgentTool[] = [
    {
      name: 'takeHeapSnapshot',
      description:
        'Capture a heap snapshot and write it to a Metro-managed artifact path.',
      inputSchema: {
        type: 'object',
        properties: {
          nameHint: NAME_HINT_SCHEMA,
        },
      },
    },
    {
      name: 'startSampling',
      description:
        'Start heap allocation sampling for the current session target.',
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
      description:
        'Stop heap allocation sampling and write the profile to a Metro-managed artifact path.',
      inputSchema: {
        type: 'object',
        properties: {
          nameHint: NAME_HINT_SCHEMA,
        },
      },
    },
  ];

  let samplingState: SamplingState | null = null;
  let heapSnapshotInProgress = false;

  const takeHeapSnapshot = async (args: unknown) => {
    if (heapSnapshotInProgress) {
      throw new Error(
        'A heap snapshot is already in progress for this session',
      );
    }

    const input = getRecord(args);
    const startedAt = Date.now();
    const writer = await deps.createArtifactWriter(
      'memory',
      'heapsnapshot',
      getString(input.nameHint),
    );
    heapSnapshotInProgress = true;

    let reportCompleted = false;
    let pendingChunkWrites = Promise.resolve();
    const chunkUnsubscribe = deps.subscribeToCDPEvent(
      'HeapProfiler.addHeapSnapshotChunk',
      (params) => {
        const chunk = getString(params.chunk);
        if (chunk) {
          pendingChunkWrites = pendingChunkWrites.then(() =>
            writer.write(chunk),
          );
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
      await pendingChunkWrites;

      const artifact = await writer.finalize();
      return createProfileResult('heap-snapshot', startedAt, artifact);
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
      sampling: samplingState,
    };
  };

  const stopSampling = async (args: unknown) => {
    if (!samplingState) {
      throw new Error('No active heap sampling session');
    }

    const input = getRecord(args);
    const startedAt = samplingState.startedAt;
    const writer = await deps.createArtifactWriter(
      'profiles',
      'heapprofile',
      getString(input.nameHint),
    );

    try {
      const result = await deps.sendCommand('HeapProfiler.stopSampling');
      await writer.write(JSON.stringify(result.profile ?? {}, null, 2));
      const artifact = await writer.finalize();
      return createProfileResult('sampling-profile', startedAt, artifact);
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
        return takeHeapSnapshot(args);
      }
      if (toolName === 'startSampling') {
        return startSampling(args);
      }
      if (toolName === 'stopSampling') {
        return stopSampling(args);
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
      description:
        'Start recording raw CDP network activity for the current session target.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'stopRecording',
      description:
        'Stop recording network activity without clearing the captured request buffer.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'getRecordingStatus',
      description:
        'Return network recording state and buffer metadata for the current session.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'listRequests',
      description:
        'List captured network request summaries with cursor pagination.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: `Maximum number of requests to return. Defaults to ${DEFAULT_DOMAIN_PAGE_LIMIT}, max ${MAX_DOMAIN_PAGE_LIMIT}.`,
          },
          cursor: {
            type: 'string',
            description:
              'Opaque pagination cursor from a previous listRequests call.',
          },
        },
      },
    },
    {
      name: 'getRequestDetails',
      description:
        'Return detailed metadata for a captured network request without bodies.',
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
      description:
        'Fetch the request body for a captured network request when supported by the target.',
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
      description:
        'Fetch the response body for a captured network request when supported by the target.',
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
            status:
              typeof redirectResponse.status === 'number'
                ? redirectResponse.status
                : undefined,
            statusText: getString(redirectResponse.statusText),
          });
          record.redirectChain = redirectChain;
        }

        record.url =
          getString(request?.url) ||
          getString(params.documentURL) ||
          record.url;
        record.method = getString(request?.method) || record.method;
        record.type = getString(params.type) || record.type;
        record.startTimeMs =
          toMilliseconds(params.timestamp) ?? record.startTimeMs;
        record.wallTimeMs =
          toMilliseconds(params.wallTime) ?? record.wallTimeMs;
        record.initiator = params.initiator ?? record.initiator;
        record.priority =
          getString(request?.initialPriority) || record.priority;
        record.request = {
          url: getString(request?.url),
          method: getString(request?.method),
          headers: getOptionalRecord(request?.headers),
          mixedContentType: getString(request?.mixedContentType),
          initialPriority: getString(request?.initialPriority),
          referrerPolicy: getString(request?.referrerPolicy),
          isSameSite: getOptionalBoolean(request?.isSameSite),
          postDataEntries: Array.isArray(request?.postDataEntries)
            ? request?.postDataEntries
            : undefined,
          hasPostData: request
            ? Boolean(request.hasPostData)
            : record.request?.hasPostData,
        };
      }),
      deps.subscribeToCDPEvent(
        'Network.requestWillBeSentExtraInfo',
        (params) => {
          const requestId = getString(params.requestId);
          if (!requestId) {
            return;
          }

          const record = ensureRecord(requestId);
          record.requestHeadersExtra =
            getOptionalRecord(params.headers) || record.requestHeadersExtra;
          record.requestAssociatedCookies = Array.isArray(
            params.associatedCookies,
          )
            ? params.associatedCookies
            : record.requestAssociatedCookies;
        },
      ),
      deps.subscribeToCDPEvent('Network.responseReceived', (params) => {
        const requestId = getString(params.requestId);
        if (!requestId) {
          return;
        }

        const record = ensureRecord(requestId);
        const response = getOptionalRecord(params.response);

        record.type = getString(params.type) || record.type;
        record.status =
          typeof response?.status === 'number'
            ? response.status
            : record.status;
        record.statusText =
          getString(response?.statusText) || record.statusText;
        record.mimeType = getString(response?.mimeType) || record.mimeType;
        record.protocol = getString(response?.protocol) || record.protocol;
        record.remoteIPAddress =
          getString(response?.remoteIPAddress) || record.remoteIPAddress;
        record.remotePort =
          getOptionalNumber(response?.remotePort) || record.remotePort;
        record.fromDiskCache =
          getOptionalBoolean(response?.fromDiskCache) ?? record.fromDiskCache;
        record.fromMemoryCache =
          getOptionalBoolean(response?.fromMemoryCache) ??
          record.fromMemoryCache;
        record.fromPrefetchCache =
          getOptionalBoolean(response?.fromPrefetchCache) ??
          record.fromPrefetchCache;
        record.encodedDataLength =
          getOptionalNumber(response?.encodedDataLength) ??
          record.encodedDataLength;
        record.response = {
          url: getString(response?.url),
          status:
            typeof response?.status === 'number' ? response.status : undefined,
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
      deps.subscribeToCDPEvent(
        'Network.responseReceivedExtraInfo',
        (params) => {
          const requestId = getString(params.requestId);
          if (!requestId) {
            return;
          }

          const record = ensureRecord(requestId);
          record.responseHeadersExtra =
            getOptionalRecord(params.headers) || record.responseHeadersExtra;
          record.responseBlockedCookies = Array.isArray(params.blockedCookies)
            ? params.blockedCookies
            : record.responseBlockedCookies;
        },
      ),
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
        record.encodedDataLength =
          getOptionalNumber(params.encodedDataLength) ??
          record.encodedDataLength;
        record.transferSize =
          getOptionalNumber(params.encodedDataLength) ?? record.transferSize;
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
        record.blockedReason =
          getString(params.blockedReason) || record.blockedReason;
        record.corsErrorStatus =
          params.corsErrorStatus ?? record.corsErrorStatus;
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
      ...createNetworkStatus(state),
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
      ...createNetworkStatus(state),
    };
  };

  const getRecordingStatus = async () => {
    return createNetworkStatus(state);
  };

  const listRequests = async (args: unknown) => {
    const input = getRecord(args);
    const limit = Math.min(
      getOptionalPositiveInteger(input.limit) ?? DEFAULT_DOMAIN_PAGE_LIMIT,
      MAX_DOMAIN_PAGE_LIMIT,
    );
    const cursor = getString(input.cursor);
    const rows = state.requestOrder
      .map((requestId) => state.requests.get(requestId))
      .filter((record): record is NetworkRequestRecord => Boolean(record))
      .reverse()
      .map(createNetworkSummary);
    const page = paginateRows(rows, {
      scope: `network:requests:${state.generation}`,
      limit,
      cursor,
    });

    return {
      ...createNetworkStatus(state),
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
      ...createNetworkStatus(state),
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
      const response = await deps.sendCommand('Network.getRequestPostData', {
        requestId,
      });
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
        reason:
          'Response body is unavailable until the request finishes loading.',
      };
    }

    try {
      const response = await deps.sendCommand('Network.getResponseBody', {
        requestId,
      });
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
        return startRecording();
      }
      if (toolName === 'stopRecording') {
        return stopRecording();
      }
      if (toolName === 'getRecordingStatus') {
        return getRecordingStatus();
      }
      if (toolName === 'listRequests') {
        return listRequests(args);
      }
      if (toolName === 'getRequestDetails') {
        return getRequestDetails(args);
      }
      if (toolName === 'getRequestBody') {
        return getRequestBody(args);
      }
      if (toolName === 'getResponseBody') {
        return getResponseBody(args);
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
        } catch {
          // Ignore transport failures during teardown.
        }
      }
      state.isRecording = false;
      state.enabled = false;
    },
  };
};
