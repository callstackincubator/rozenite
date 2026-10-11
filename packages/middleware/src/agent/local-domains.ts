import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  MEMORY_TOOL_NAMES,
  NETWORK_TOOL_NAMES,
  PERFORMANCE_TOOL_NAMES,
  REACT_TOOL_NAMES,
  type AgentTool,
  type AgentToolPagination,
  type JSONSchema7,
  paginateArray,
} from '@rozenite/agent-shared';
import { createReactTreeStore } from './runtime/react/store.js';
import { CdpEventTimeoutError } from './cdp-errors.js';
import type { ArtifactBucket, ArtifactFileWriter } from './artifacts.js';
import type {
  ReactTreeNode,
  ReactNodeSummary,
  ReactInspectableEntry,
  ReactRenderDataItem,
  ReactProfileTimelineItem,
  ReactComponentRenderItem,
} from './runtime/react/types.js';

/**
 * Ties a tool's declared pagination `fields`/`defaultFields` to the keys of
 * its actual row type at compile time, so a renamed or removed field on
 * `TRow` becomes a build error here instead of a silent `null` column at
 * runtime.
 */
const cursorPagination = <TRow>(config: {
  fields: readonly Extract<keyof TRow, string>[];
  defaultFields?: readonly Extract<keyof TRow, string>[];
  /**
   * Result keys besides `items` and `page` worth printing with every page.
   * The SDK result keeps every key; this only steers what a frontend shows.
   */
  meta: readonly string[];
}): AgentToolPagination => ({
  kind: 'cursor',
  fields: config.fields,
  ...(config.defaultFields ? { defaultFields: config.defaultFields } : {}),
  meta: config.meta,
});

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
  /** Size of the whole body in bytes, before `offset`/`maxBytes` were applied. */
  totalBytes?: number;
  /** True when bytes remain after the returned slice. */
  truncated?: boolean;
  /** Where the next slice starts; present only when `truncated` is true. */
  nextOffset?: number;
  reason?: string;
};

const DEFAULT_BODY_MAX_BYTES = 16_384;

const NETWORK_DETAIL_SECTIONS = [
  'headers',
  'timing',
  'initiator',
  'cookies',
  'redirectChain',
] as const;
type NetworkDetailSection = (typeof NETWORK_DETAIL_SECTIONS)[number];
const DEFAULT_NETWORK_DETAIL_SECTIONS: readonly NetworkDetailSection[] = ['headers'];

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
  /**
   * The static agent domain this service backs. Used to look the service
   * up in a capability profile — static tool names are bare
   * (`takeHeapSnapshot`, not `memory.takeHeapSnapshot`), so without this
   * the domain would have to be recovered by reverse-searching the tool
   * name table.
   */
  domainId: string;
  getTools: () => AgentTool[];
  callTool: (toolName: string, args: unknown) => Promise<unknown | undefined>;
  captureReactDevToolsMessage?: (message: unknown) => Promise<void>;
  onDisconnected: () => void;
  dispose: () => Promise<void>;
};

const NAME_HINT_SCHEMA: JSONSchema7 = {
  type: 'string',
  description: 'Optional file naming hint used for the Metro-managed artifact filename.',
};

/**
 * Deadlines for device events that complete a long-running capture.
 * Generous: a real trace or heap snapshot on a slow device legitimately
 * takes a while, and these exist to convert "never" into an error, not
 * to police latency.
 */
const TRACE_COMPLETION_TIMEOUT_MS = 60_000;
const HEAP_SNAPSHOT_TIMEOUT_MS = 120_000;

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

const readBodyWindow = (input: Record<string, unknown>): { maxBytes: number; offset: number } => {
  const { maxBytes, offset } = input;
  if (
    maxBytes !== undefined &&
    (typeof maxBytes !== 'number' || !Number.isInteger(maxBytes) || maxBytes < 1)
  ) {
    throw new Error('"maxBytes" must be a positive integer');
  }
  if (
    offset !== undefined &&
    (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0)
  ) {
    throw new Error('"offset" must be a non-negative integer');
  }

  return {
    maxBytes: (maxBytes as number | undefined) ?? DEFAULT_BODY_MAX_BYTES,
    offset: (offset as number | undefined) ?? 0,
  };
};

const isUtf8ContinuationByte = (byte: number | undefined): boolean =>
  byte !== undefined && (byte & 0xc0) === 0x80;

/**
 * Cut one window out of a body, counting UTF-8 bytes.
 *
 * Both edges are moved onto character boundaries so a multi-byte character is
 * never split: the start moves forward, the end moves back (or forward, when
 * `maxBytes` is smaller than the character at the start). For a base64 body
 * every character is one byte, so the window counts base64 characters.
 */
const sliceBody = (
  body: string,
  window: { maxBytes: number; offset: number },
): Pick<NetworkBodyResult, 'body' | 'totalBytes' | 'truncated' | 'nextOffset'> => {
  const bytes = Buffer.from(body, 'utf8');
  const totalBytes = bytes.length;

  let start = Math.min(window.offset, totalBytes);
  while (start < totalBytes && isUtf8ContinuationByte(bytes[start])) {
    start += 1;
  }

  let end = Math.min(start + window.maxBytes, totalBytes);
  while (end > start && end < totalBytes && isUtf8ContinuationByte(bytes[end])) {
    end -= 1;
  }
  if (end === start && start < totalBytes) {
    end = start + 1;
    while (end < totalBytes && isUtf8ContinuationByte(bytes[end])) {
      end += 1;
    }
  }

  const truncated = end < totalBytes;
  return {
    body: start === 0 && end === totalBytes ? body : bytes.subarray(start, end).toString('utf8'),
    totalBytes,
    truncated,
    ...(truncated ? { nextOffset: end } : {}),
  };
};

const readDetailSections = (value: unknown): Set<NetworkDetailSection> => {
  if (value === undefined) {
    return new Set(DEFAULT_NETWORK_DETAIL_SECTIONS);
  }

  if (!Array.isArray(value)) {
    throw new Error(`"include" must be an array of ${NETWORK_DETAIL_SECTIONS.join(', ')}`);
  }

  const sections = new Set<NetworkDetailSection>();
  for (const entry of value) {
    if (!NETWORK_DETAIL_SECTIONS.includes(entry as NetworkDetailSection)) {
      throw new Error(
        `Unknown "include" value ${JSON.stringify(entry)}. Use ${NETWORK_DETAIL_SECTIONS.join(', ')}.`,
      );
    }
    sections.add(entry as NetworkDetailSection);
  }

  return sections;
};

/** Drop keys whose value is `undefined` or `null`, so absent data costs nothing. */
const omitNullish = <T extends Record<string, unknown>>(value: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null),
  ) as Partial<T>;
};

const getInitiatorType = (initiator: unknown): string | undefined => {
  return getString(getOptionalRecord(initiator)?.type);
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
  encodedDataLength: record.encodedDataLength ?? record.response?.encodedDataLength ?? null,
  outcome: record.loadingFailed ? 'failed' : record.loadingFinished ? 'success' : 'in-flight',
});

type NetworkRequestSummary = ReturnType<typeof createNetworkSummary>;

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

const getCDPCommandResult = (value: Record<string, unknown>): Record<string, unknown> => {
  return getOptionalRecord(value.result) || value;
};

/**
 * Waits for one CDP event, with a deadline.
 *
 * The deadline is the point: a device can accept a command and then
 * never emit the event that completes it — a runtime whose domain shares
 * a name with Chrome's but not its semantics does exactly that. Without
 * a timeout the awaiting tool hangs forever, which is strictly worse for
 * an agent than an error, because there is nothing to react to. This
 * guard is platform-agnostic on purpose: it catches the case for
 * runtimes no capability profile has been written for yet.
 */
const createCDPEventWaiter = (
  subscribeToCDPEvent: SubscribeToCDPEvent,
  method: string,
  options: { timeoutMs?: number; hint?: string } = {},
): {
  promise: Promise<Record<string, unknown>>;
  cancel: () => void;
} => {
  let unsubscribe = () => {};
  let timer: NodeJS.Timeout | null = null;

  const cleanup = (): void => {
    unsubscribe();
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
    unsubscribe = subscribeToCDPEvent(method, (params) => {
      cleanup();
      resolve(params);
    });

    const timeoutMs = options.timeoutMs;
    if (timeoutMs !== undefined) {
      timer = setTimeout(() => {
        cleanup();
        reject(new CdpEventTimeoutError(method, timeoutMs, options.hint));
      }, timeoutMs);
    }
  });

  return {
    promise,
    cancel: cleanup,
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
      name: PERFORMANCE_TOOL_NAMES.startTrace,
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
      name: PERFORMANCE_TOOL_NAMES.stopTrace,
      description: 'Stop the active trace and write the result to a Metro-managed artifact path.',
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
    const writer = await deps.createArtifactWriter('traces', 'json', getString(input.nameHint));
    let pendingWrites = Promise.resolve();
    let wroteHeader = false;
    // Counts events actually written, not events announced. A device can
    // emit Tracing.dataCollected with an absent or non-array `value` --
    // exactly what a runtime whose Tracing domain only shares Chrome's
    // NAME would do -- and counting the event rather than its contents
    // would let that through as a successful capture of nothing.
    let writtenEventCount = 0;
    let traceWindow: { min: number; max: number } | null = null;
    const tracingComplete = createCDPEventWaiter(
      deps.subscribeToCDPEvent,
      'Tracing.tracingComplete',
      {
        timeoutMs: TRACE_COMPLETION_TIMEOUT_MS,
        hint: "The target may implement a tracing protocol other than Chrome's.",
      },
    );
    const unsubscribeDataCollected = deps.subscribeToCDPEvent('Tracing.dataCollected', (params) => {
      const values = Array.isArray(params.value) ? params.value : [];
      pendingWrites = pendingWrites.then(async () => {
        for (const item of values) {
          // Written lazily, per event rather than per event batch, so an
          // empty batch leaves the artifact untouched instead of opening
          // one that the guard below will then have to abort.
          if (!wroteHeader) {
            await writer.write('{"traceEvents":[');
            wroteHeader = true;
          }

          if (typeof item?.ts === 'number' && Number.isFinite(item.ts)) {
            traceWindow = traceWindow
              ? {
                  min: Math.min(traceWindow.min, item.ts),
                  max: Math.max(traceWindow.max, item.ts),
                }
              : { min: item.ts, max: item.ts };
          }
          if (writtenEventCount > 0) {
            await writer.write(',');
          }
          await writer.write(JSON.stringify(item));
          writtenEventCount += 1;
        }
      });
    });

    try {
      await deps.sendCommand('Tracing.end');
      await tracingComplete.promise;
      await pendingWrites;
      if (writtenEventCount === 0) {
        // The device reported the trace complete without handing over a
        // single event. Writing the empty-but-valid artifact this used
        // to produce hands back a file that looks like a successful
        // capture and contains nothing, which is the hardest kind of
        // failure for an agent to notice.
        throw new Error(
          'The trace completed without a single trace event, so nothing was captured. This ' +
            'target does not appear to implement Chrome-style tracing.',
        );
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
    domainId: 'performance',
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
  sendReactDevToolsMessage: (message: { event: string; payload: unknown }) => void;
}): LocalAgentToolService => {
  const nodeIdentifierSchema = {
    oneOf: [{ type: 'integer' }, { type: 'string' }],
  };
  const nodeIdentifierRequirement = {
    anyOf: [{ required: ['id'] }, { required: ['nodeId'] }],
  };
  const limitSchema = {
    type: 'integer',
    description: 'Page size. Default 20, max 100.',
  };
  const cursorSchema = {
    type: 'string',
    description: 'Opaque cursor returned by the previous page.',
  };
  const noHostSchema = {
    type: 'boolean',
    description:
      'Hide plain host components — the native views React renders into. Defaults to false. ' +
      'Usually a no-op: React DevTools hides host components at the backend by default, so ' +
      'they rarely reach this tree at all; set this only when a DevTools frontend on the same ' +
      'backend has turned them back on. Host nodes with a key, a hyphenated custom element ' +
      'name, or logged errors or warnings are kept either way.',
  };
  const maxValueLengthSchema = {
    type: 'number',
    description:
      'Truncate serialized string values longer than this, marking the cut with ' +
      '"[+N chars]". Default 512, max 8192.',
  };
  const slowRenderThresholdSchema = {
    type: 'number',
    description: 'Threshold used to classify slow renders. Default 16ms.',
  };
  const tools: AgentTool[] = [
    {
      name: REACT_TOOL_NAMES.getTree,
      description:
        'Get the current React component tree with optional depth limiting and cursor-based ' +
        'pagination. With noHost, parentId, childIds and depth describe the filtered tree, so ' +
        'following childIds always lands on a node the same call returns.',
      inputSchema: {
        type: 'object',
        properties: {
          root: {
            ...nodeIdentifierSchema,
            description: 'Optional node ID or component label to scope the tree to a subtree.',
          },
          depth: {
            type: 'integer',
            description:
              'Optional max descendant depth relative to the selected root. 0 returns only roots.',
          },
          noHost: noHostSchema,
          limit: limitSchema,
          cursor: cursorSchema,
        },
      },
      pagination: cursorPagination<ReactTreeNode>({
        meta: ['roots', 'totalCount'],
        fields: [
          'nodeId',
          'label',
          'displayName',
          'elementType',
          'key',
          'childCount',
          'parentId',
          'parentLabel',
          'childIds',
          'depth',
          'errorCount',
          'warningCount',
        ],
        // `label` identifies the node as well as `nodeId` does and every React
        // tool accepts it; the rest stay reachable through --fields.
        defaultFields: ['label', 'displayName', 'childCount', 'depth'],
      }),
    },
    {
      name: REACT_TOOL_NAMES.getComponent,
      description:
        'Get a React node summary plus inspected props, state, and hooks in one response.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            ...nodeIdentifierSchema,
            description: 'React DevTools node ID or component label.',
          },
          nodeId: {
            ...nodeIdentifierSchema,
            description: 'React DevTools node ID or component label.',
          },
          include: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['props', 'state', 'hooks'],
            },
            description: 'Optional sections to include. Defaults to props, state, and hooks.',
          },
          valueDepth: {
            type: 'integer',
            description: 'Max nested serialization depth. Default 4, max 8.',
          },
          maxValueLength: maxValueLengthSchema,
        },
        anyOf: [{ required: ['id'] }, { required: ['nodeId'] }],
      },
    },
    {
      name: REACT_TOOL_NAMES.getNode,
      description: 'Get a single React node summary by node ID or label.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            ...nodeIdentifierSchema,
            description: 'React DevTools node ID or component label.',
          },
          nodeId: {
            ...nodeIdentifierSchema,
            description: 'React DevTools node ID or component label.',
          },
        },
        ...nodeIdentifierRequirement,
      },
    },
    {
      name: REACT_TOOL_NAMES.getChildren,
      description:
        "Get a node's direct children by node ID or label with cursor-based pagination. With " +
        'noHost, a hidden host is replaced by its own children.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            ...nodeIdentifierSchema,
            description: 'Parent node ID or component label.',
          },
          nodeId: {
            ...nodeIdentifierSchema,
            description: 'Parent node ID or component label.',
          },
          noHost: noHostSchema,
          limit: limitSchema,
          cursor: cursorSchema,
        },
        ...nodeIdentifierRequirement,
      },
      pagination: cursorPagination<ReactNodeSummary>({
        meta: [],
        fields: [
          'nodeId',
          'label',
          'displayName',
          'elementType',
          'key',
          'childCount',
          'parentId',
          'parentLabel',
          'errorCount',
          'warningCount',
        ],
        defaultFields: ['label', 'displayName', 'childCount'],
      }),
    },
    {
      name: REACT_TOOL_NAMES.getProps,
      description: 'Get inspected props for a node with cursor-based pagination.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            ...nodeIdentifierSchema,
            description: 'Node ID or component label to read props for.',
          },
          nodeId: {
            ...nodeIdentifierSchema,
            description: 'Node ID or component label to read props for.',
          },
          maxValueLength: maxValueLengthSchema,
          limit: limitSchema,
          cursor: cursorSchema,
        },
        ...nodeIdentifierRequirement,
      },
      pagination: cursorPagination<ReactInspectableEntry>({
        meta: [],
        // Only two fields exist; there is nothing sensible to trim.
        fields: ['name', 'value'],
      }),
    },
    {
      name: REACT_TOOL_NAMES.getState,
      description: 'Get inspected state for a node with cursor-based pagination.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            ...nodeIdentifierSchema,
            description: 'Node ID or component label to read state for.',
          },
          nodeId: {
            ...nodeIdentifierSchema,
            description: 'Node ID or component label to read state for.',
          },
          maxValueLength: maxValueLengthSchema,
          limit: limitSchema,
          cursor: cursorSchema,
        },
        ...nodeIdentifierRequirement,
      },
      pagination: cursorPagination<ReactInspectableEntry>({
        meta: [],
        // Only two fields exist; there is nothing sensible to trim.
        fields: ['name', 'value'],
      }),
    },
    {
      name: REACT_TOOL_NAMES.getHooks,
      description: 'Get inspected hooks for a node with cursor-based pagination.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            ...nodeIdentifierSchema,
            description: 'Node ID or component label to read hooks for.',
          },
          nodeId: {
            ...nodeIdentifierSchema,
            description: 'Node ID or component label to read hooks for.',
          },
          path: {
            type: 'array',
            items: {
              oneOf: [{ type: 'string' }, { type: 'integer' }],
            },
            description: 'Optional path into hooks tree, e.g. [0, "subHooks"].',
          },
          maxValueLength: maxValueLengthSchema,
          limit: limitSchema,
          cursor: cursorSchema,
        },
        ...nodeIdentifierRequirement,
      },
      pagination: cursorPagination<ReactInspectableEntry>({
        meta: [],
        // Only two fields exist; there is nothing sensible to trim.
        fields: ['name', 'value'],
      }),
    },
    {
      name: REACT_TOOL_NAMES.searchNodes,
      description: 'Search React component tree nodes by display name or key.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query. Required and non-empty.',
          },
          rootId: {
            ...nodeIdentifierSchema,
            description: 'Optional root node ID or component label to scope search to a subtree.',
          },
          match: {
            type: 'string',
            enum: ['name', 'name-or-key'],
            description: 'Matching mode. Defaults to "name".',
          },
          noHost: noHostSchema,
          limit: limitSchema,
          cursor: cursorSchema,
        },
        required: ['query'],
      },
      pagination: cursorPagination<ReactNodeSummary>({
        meta: [],
        fields: [
          'nodeId',
          'label',
          'displayName',
          'elementType',
          'key',
          'childCount',
          'parentId',
          'parentLabel',
          'errorCount',
          'warningCount',
        ],
        defaultFields: ['label', 'displayName', 'childCount', 'parentLabel'],
      }),
    },
    {
      name: REACT_TOOL_NAMES.getErrors,
      description:
        'List the components React logged errors or warnings against, most errors first. ' +
        'Covers warnings as well as errors; counts are cumulative and reset when a component ' +
        'remounts.',
      inputSchema: {
        type: 'object',
        properties: {
          root: {
            ...nodeIdentifierSchema,
            description: 'Optional root node ID or component label to scope the search.',
          },
          limit: limitSchema,
          cursor: cursorSchema,
        },
      },
      pagination: cursorPagination<ReactNodeSummary>({
        meta: ['totalCount', 'summary'],
        fields: [
          'nodeId',
          'label',
          'displayName',
          'elementType',
          'key',
          'childCount',
          'parentId',
          'parentLabel',
          'errorCount',
          'warningCount',
        ],
        defaultFields: ['nodeId', 'label', 'displayName', 'errorCount', 'warningCount'],
      }),
    },
    {
      name: REACT_TOOL_NAMES.startProfiling,
      description: 'Start React profiling or request reload-and-profile when supported.',
      inputSchema: {
        type: 'object',
        properties: {
          shouldRestart: {
            type: 'boolean',
            description: 'If true, requests reload-and-profile instead of starting immediately.',
          },
        },
      },
    },
    {
      name: REACT_TOOL_NAMES.isProfilingStarted,
      description: 'Get current React profiling status and recorded data availability.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: REACT_TOOL_NAMES.stopProfiling,
      description: 'Stop React profiling and return a compact summary of the captured session.',
      inputSchema: {
        type: 'object',
        properties: {
          waitForDataMs: {
            type: 'number',
            description:
              'Max wait for backend profiling data processing. Default 3000ms, max 10000ms.',
          },
          slowRenderThresholdMs: slowRenderThresholdSchema,
        },
      },
    },
    {
      name: REACT_TOOL_NAMES.getComponentRenders,
      description:
        'Get per-component render totals aggregated across every commit of the captured ' +
        'profiling session: render count, total/average/max render time, and why each ' +
        'component rendered. This is the tool that answers "what was slow" and "what ' +
        're-rendered too often" in one call — reach for getRenderData only to drill into a ' +
        "single commit afterwards. Pass id/fiberId to get one component's report.",
      inputSchema: {
        type: 'object',
        properties: {
          rootId: {
            type: 'integer',
            description: 'Optional React root ID. Defaults to every root in the session.',
          },
          id: {
            ...nodeIdentifierSchema,
            description: 'Optional node ID or component label to report on a single component.',
          },
          fiberId: {
            ...nodeIdentifierSchema,
            description: 'Optional node ID or component label to report on a single component.',
          },
          sort: {
            type: 'string',
            enum: [
              'total-duration-desc',
              'avg-duration-desc',
              'max-duration-desc',
              'render-count-desc',
              'name-asc',
            ],
            description: 'Sort order. Defaults to "total-duration-desc".',
          },
          slowRenderThresholdMs: slowRenderThresholdSchema,
          limit: limitSchema,
          cursor: cursorSchema,
        },
      },
      pagination: cursorPagination<ReactComponentRenderItem>({
        meta: ['totalCount', 'summary'],
        fields: [
          'rootId',
          'fiberId',
          'label',
          'displayName',
          'renderCount',
          'totalDurationMs',
          'avgDurationMs',
          'maxDurationMs',
          'totalSelfDurationMs',
          'slowRenderCount',
          'slowestCommitIndex',
          'changeTypeHints',
          'changedKeys',
        ],
        // avgDurationMs is totalDurationMs / renderCount; request it with --fields.
        defaultFields: [
          'fiberId',
          'label',
          'displayName',
          'renderCount',
          'totalDurationMs',
          'maxDurationMs',
          'changeTypeHints',
        ],
      }),
    },
    {
      name: REACT_TOOL_NAMES.getProfileTimeline,
      description:
        'List every commit in the captured profiling session with its duration and how many ' +
        'fibers rendered, chronologically or slowest first. Use it to pick a commitIndex for ' +
        'getRenderData; unlike stopProfiling it stays queryable and pages through all commits. ' +
        'Request the effectDurationMs, passiveEffectDurationMs, priorityLevel, updaterCount and ' +
        'hasChangeDescriptions fields to see commit cost beyond render time.',
      inputSchema: {
        type: 'object',
        properties: {
          rootId: {
            type: 'integer',
            description: 'Optional React root ID. Defaults to every root in the session.',
          },
          sort: {
            type: 'string',
            enum: ['timeline', 'duration-desc'],
            description: 'Sort order. Defaults to "timeline" (chronological).',
          },
          slowRenderThresholdMs: slowRenderThresholdSchema,
          limit: limitSchema,
          cursor: cursorSchema,
        },
      },
      pagination: cursorPagination<ReactProfileTimelineItem>({
        meta: ['totalCount', 'summary'],
        fields: [
          'rootId',
          'commitIndex',
          'durationMs',
          'timestampMs',
          'renderedFiberCount',
          'isSlow',
          'effectDurationMs',
          'passiveEffectDurationMs',
          'priorityLevel',
          'updaterCount',
          'hasChangeDescriptions',
        ],
        defaultFields: ['rootId', 'commitIndex', 'durationMs', 'renderedFiberCount', 'isSlow'],
      }),
    },
    {
      name: REACT_TOOL_NAMES.getRenderData,
      description:
        'Get a paged summary of a single React commit by rootId and commitIndex. Each ' +
        'item is a fiber that rendered, with its displayName, timing, and why it rendered ' +
        '(changeTypeHints plus the specific changed prop/state/context key names in changedKeys).',
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
          sort: {
            type: 'string',
            enum: ['duration-desc', 'name-asc'],
            description: 'Sort order. Defaults to "duration-desc".',
          },
          slowRenderThresholdMs: {
            type: 'number',
            description: 'Threshold used to classify slow fibers. Default 16ms.',
          },
          limit: limitSchema,
          cursor: cursorSchema,
        },
        required: ['rootId', 'commitIndex'],
      },
      pagination: cursorPagination<ReactRenderDataItem>({
        meta: ['commit', 'summary'],
        fields: [
          'fiberId',
          'displayName',
          'actualDurationMs',
          'selfDurationMs',
          'isSlow',
          'changeTypeHints',
          'changedKeys',
        ],
        defaultFields: ['fiberId', 'displayName', 'actualDurationMs', 'selfDurationMs', 'isSlow'],
      }),
    },
  ];

  const sessionDeviceId = `react-session:${deps.sessionId}`;
  const store = createReactTreeStore();
  const bindDevice = (): void => {
    store.registerDevice(sessionDeviceId, {
      sendMessage: deps.sendReactDevToolsMessage,
    });
  };
  bindDevice();

  return {
    domainId: 'react',
    getTools: () => tools,
    callTool: async (toolName, args) => {
      switch (toolName) {
        case 'getTree':
          return store.getTree(sessionDeviceId, args);
        case 'getComponent':
          return store.getComponent(sessionDeviceId, args);
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
        case 'getErrors':
          return store.getErrors(sessionDeviceId, args);
        case 'getProfileTimeline':
          return store.getProfileTimeline(sessionDeviceId, args);
        case 'getComponentRenders':
          return store.getComponentRenders(sessionDeviceId, args);
        default:
          return undefined;
      }
    },
    captureReactDevToolsMessage: async (message) => {
      await store.ingestReactDevToolsMessage(sessionDeviceId, message);
    },
    onDisconnected: () => {
      // Drop the tree, inspections and profiling state captured from the app
      // process that just went away, then immediately re-bind the outbound
      // channel. The session recovers on its own after an app relaunch, but
      // nothing re-registers this device, so without this the recreated state
      // would come back with no `sendMessage`: inbound operations keep
      // populating a correct tree while every outbound request
      // (inspectElement, startProfiling, getProfilingData) is silently
      // dropped. `sendReactDevToolsMessage` is bound to the session rather
      // than to one socket generation, so it stays valid across recovery.
      store.unregisterDevice(sessionDeviceId);
      bindDevice();
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
      name: MEMORY_TOOL_NAMES.takeHeapSnapshot,
      description: 'Capture a heap snapshot and write it to a Metro-managed artifact path.',
      inputSchema: {
        type: 'object',
        properties: {
          nameHint: NAME_HINT_SCHEMA,
        },
      },
    },
    {
      name: MEMORY_TOOL_NAMES.startSampling,
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
      name: MEMORY_TOOL_NAMES.stopSampling,
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
      throw new Error('A heap snapshot is already in progress for this session');
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
          pendingChunkWrites = pendingChunkWrites.then(() => writer.write(chunk));
        }
      },
    );
    let unsubscribeProgress = () => {};
    let progressTimer: NodeJS.Timeout | null = null;
    const clearProgressTimer = (): void => {
      if (progressTimer) {
        clearTimeout(progressTimer);
        progressTimer = null;
      }
    };
    const progressPromise = new Promise<void>((resolve, reject) => {
      unsubscribeProgress = deps.subscribeToCDPEvent(
        'HeapProfiler.reportHeapSnapshotProgress',
        (params) => {
          if (params.finished === true) {
            reportCompleted = true;
            clearProgressTimer();
            unsubscribeProgress();
            resolve();
          }
        },
      );

      progressTimer = setTimeout(() => {
        unsubscribeProgress();
        reject(
          new CdpEventTimeoutError(
            'HeapProfiler.reportHeapSnapshotProgress',
            HEAP_SNAPSHOT_TIMEOUT_MS,
            'The device accepted takeHeapSnapshot but never reported completion.',
          ),
        );
      }, HEAP_SNAPSHOT_TIMEOUT_MS);
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
      clearProgressTimer();
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
    domainId: 'memory',
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
      name: NETWORK_TOOL_NAMES.startRecording,
      description: 'Start recording raw CDP network activity for the current session target.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: NETWORK_TOOL_NAMES.stopRecording,
      description: 'Stop recording network activity without clearing the captured request buffer.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: NETWORK_TOOL_NAMES.getRecordingStatus,
      description: 'Return network recording state and buffer metadata for the current session.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: NETWORK_TOOL_NAMES.listRequests,
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
      pagination: cursorPagination<NetworkRequestSummary>({
        // The `recording` block stays in the result for SDK callers, but it is
        // the same on every page and one getRecordingStatus call away.
        meta: [],
        fields: [
          'requestId',
          'method',
          'url',
          'status',
          'type',
          'startTimeMs',
          'endTimeMs',
          'durationMs',
          'transferSize',
          'encodedDataLength',
          'outcome',
        ],
        defaultFields: ['requestId', 'method', 'url', 'status', 'durationMs', 'outcome'],
      }),
    },
    {
      name: NETWORK_TOOL_NAMES.getRequestDetails,
      description:
        'Return detailed metadata for a captured network request without bodies. Keys with no ' +
        'value are omitted; initiator carries only its type unless include names "initiator".',
      inputSchema: {
        type: 'object',
        properties: {
          requestId: {
            type: 'string',
            description: 'Captured CDP requestId to inspect.',
          },
          include: {
            type: 'array',
            items: {
              type: 'string',
              enum: [...NETWORK_DETAIL_SECTIONS],
            },
            description:
              'Optional sections to include. Defaults to ["headers"]. "timing" adds response.timing, ' +
              '"initiator" the full initiator with its stack, "cookies" the associated and blocked ' +
              'cookies, "redirectChain" the redirects that led here.',
          },
        },
        required: ['requestId'],
      },
    },
    {
      name: NETWORK_TOOL_NAMES.getRequestBody,
      description:
        'Fetch the request body for a captured network request when supported by the target.',
      inputSchema: {
        type: 'object',
        properties: {
          requestId: {
            type: 'string',
            description: 'Captured CDP requestId to inspect.',
          },
          maxBytes: {
            type: 'integer',
            description: `Maximum bytes of body to return. Defaults to ${DEFAULT_BODY_MAX_BYTES}. The result reports totalBytes, truncated and, when truncated, nextOffset.`,
          },
          offset: {
            type: 'integer',
            description:
              'Byte offset to start reading from, for reading a large body in slices. Defaults to 0.',
          },
        },
        required: ['requestId'],
      },
    },
    {
      name: NETWORK_TOOL_NAMES.getResponseBody,
      description:
        'Fetch the response body for a captured network request when supported by the target. ' +
        'Text bodies the target sent base64-encoded are decoded; byte counts then refer to the decoded text.',
      inputSchema: {
        type: 'object',
        properties: {
          requestId: {
            type: 'string',
            description: 'Captured CDP requestId to inspect.',
          },
          maxBytes: {
            type: 'integer',
            description: `Maximum bytes of body to return. Defaults to ${DEFAULT_BODY_MAX_BYTES}. The result reports totalBytes, truncated and, when truncated, nextOffset.`,
          },
          offset: {
            type: 'integer',
            description:
              'Byte offset to start reading from, for reading a large body in slices. Defaults to 0.',
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
              typeof redirectResponse.status === 'number' ? redirectResponse.status : undefined,
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
          postDataEntries: Array.isArray(request?.postDataEntries)
            ? request?.postDataEntries
            : undefined,
          hasPostData: request ? Boolean(request.hasPostData) : record.request?.hasPostData,
        };
      }),
      deps.subscribeToCDPEvent('Network.requestWillBeSentExtraInfo', (params) => {
        const requestId = getString(params.requestId);
        if (!requestId) {
          return;
        }

        const record = ensureRecord(requestId);
        record.requestHeadersExtra =
          getOptionalRecord(params.headers) || record.requestHeadersExtra;
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
        record.fromMemoryCache =
          getOptionalBoolean(response?.fromMemoryCache) ?? record.fromMemoryCache;
        record.fromPrefetchCache =
          getOptionalBoolean(response?.fromPrefetchCache) ?? record.fromPrefetchCache;
        record.encodedDataLength =
          getOptionalNumber(response?.encodedDataLength) ?? record.encodedDataLength;
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
        record.responseHeadersExtra =
          getOptionalRecord(params.headers) || record.responseHeadersExtra;
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
        record.encodedDataLength =
          getOptionalNumber(params.encodedDataLength) ?? record.encodedDataLength;
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
    const rows = state.requestOrder
      .map((requestId) => state.requests.get(requestId))
      .filter((record): record is NetworkRequestRecord => Boolean(record))
      .reverse()
      .map(createNetworkSummary);
    // The capture buffer is wiped on disconnect and on a new recording, which
    // bumps the generation, so a cursor from before then answers `reset`.
    const page = paginateArray(rows, {
      keyOf: (row) => row.requestId,
      limit: input.limit,
      cursor: input.cursor,
      generation: state.generation,
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

    const include = readDetailSections(input.include);
    const record = getRecordById(requestId);

    let request: Record<string, unknown> | undefined;
    if (record.request) {
      const { headers, ...rest } = record.request;
      request = include.has('headers') ? { ...rest, headers } : rest;
    }

    let response: Record<string, unknown> | undefined;
    if (record.response) {
      const { headers, timing, ...rest } = record.response;
      response = {
        ...rest,
        ...(include.has('headers') ? { headers } : {}),
        ...(include.has('timing') ? { timing } : {}),
      };
    }

    const initiatorType = getInitiatorType(record.initiator);
    const initiator = include.has('initiator')
      ? record.initiator
      : initiatorType !== undefined
        ? { type: initiatorType }
        : undefined;

    return {
      ...createNetworkStatus(state),
      request: omitNullish({
        requestId: record.requestId,
        method: record.method || record.request?.method,
        url: record.url || record.request?.url,
        type: record.type,
        priority: record.priority,
        initiator,
        startTimeMs: record.startTimeMs,
        wallTimeMs: record.wallTimeMs,
        endTimeMs: record.endTimeMs,
        durationMs: record.durationMs,
        request,
        ...(include.has('headers')
          ? {
              requestHeadersExtra: record.requestHeadersExtra,
              responseHeadersExtra: record.responseHeadersExtra,
            }
          : {}),
        ...(include.has('cookies')
          ? {
              requestAssociatedCookies: record.requestAssociatedCookies,
              responseBlockedCookies: record.responseBlockedCookies,
            }
          : {}),
        response,
        ...(include.has('redirectChain') ? { redirectChain: record.redirectChain ?? [] } : {}),
        servedFromCache: record.servedFromCache ?? false,
        loadingFinished: record.loadingFinished ?? false,
        loadingFailed: record.loadingFailed ?? false,
        failureText: record.failureText,
        blockedReason: record.blockedReason,
        corsErrorStatus: record.corsErrorStatus,
      }),
    };
  };

  const getRequestBody = async (args: unknown): Promise<NetworkBodyResult> => {
    const input = getRecord(args);
    const requestId = getString(input.requestId);
    if (!requestId) {
      throw new Error('"requestId" is required');
    }

    const window = readBodyWindow(input);
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
        base64Encoded: false,
        ...sliceBody(body, window),
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

    const window = readBodyWindow(input);
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
            base64Encoded: false,
            decoded: true,
            mimeType,
            ...sliceBody(Buffer.from(body, 'base64').toString('utf8'), window),
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
        base64Encoded,
        decoded: false,
        mimeType,
        ...sliceBody(body, window),
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
    domainId: 'network',
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
      resetCapture();
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
