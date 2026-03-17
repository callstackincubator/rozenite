import { hashFilters } from '../pagination/cursor.js';
import type {
  ReactDevToolsBridgeMessage,
  ReactGetChildrenResult,
  ReactGetInspectableResult,
  ReactGetRenderDataResult,
  ReactInspectedNodeRecord,
  ReactProfilingCursorPayload,
  ReactProfilingStatusResult,
  ReactRenderDataItem,
  ReactRenderDataSort,
  ReactNodeRecord,
  ReactNodeSummary,
  ReactSearchNodesResult,
  ReactStartProfilingResult,
  ReactStopProfilingResult,
  ReactTreeNodeInput,
  ReactTreeSyncPayload,
} from './types.js';
import { createReactDevToolsBridge, type ReactDevToolsBridge } from './react-devtools-bridge.js';

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 100;
const SEARCH_TOOL_NAME = 'searchNodes';
const GET_CHILDREN_TOOL_NAME = 'getChildren';
const GET_PROPS_TOOL_NAME = 'getProps';
const GET_STATE_TOOL_NAME = 'getState';
const GET_HOOKS_TOOL_NAME = 'getHooks';
const GET_RENDER_DATA_TOOL_NAME = 'getRenderData';
const INSPECT_WAIT_TIMEOUT_MS = 2000;
const DEFAULT_STOP_PROFILING_WAIT_MS = 3000;
const MAX_STOP_PROFILING_WAIT_MS = 10000;
const DEFAULT_SLOW_RENDER_THRESHOLD_MS = 16;
const TOP_SLOW_COMMITS_LIMIT = 10;
const MAX_PENDING_REACT_MESSAGES = 1000;

interface ReactCursorPayload {
  v: 1;
  tool: string;
  deviceId: string;
  offset: number;
  filtersHash: string;
}

type ReactCommitData = {
  changeDescriptions: Map<number, ReactChangeDescription> | null;
  duration: number;
  effectDuration: number | null;
  fiberActualDurations: Map<number, number>;
  fiberSelfDurations: Map<number, number>;
  passiveEffectDuration: number | null;
  priorityLevel: string | null;
  timestamp: number;
  updaters: Array<{ id: number }> | null;
};

type ReactChangeDescription = {
  context: string[] | boolean | null;
  didHooksChange: boolean;
  isFirstMount: boolean;
  props: string[] | null;
  state: string[] | null;
};

type DeviceReactTreeState = {
  rootIds: number[];
  nodesById: Map<number, ReactNodeRecord>;
  inspectedById: Map<number, ReactInspectedNodeRecord>;
  bridge: ReactDevToolsBridge | null;
  bridgePromise: Promise<ReactDevToolsBridge> | null;
  pendingMessages: Array<{ event: string; payload: unknown }>;
  droppedPendingMessages: number;
  sendMessage?: (message: { event: string; payload: unknown }) => void;
  pendingInspectionsByNodeId: Map<number, Array<(inspected: ReactInspectedNodeRecord | null) => void>>;
  nextInspectRequestId: number;
};

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const encodeCursor = (payload: ReactCursorPayload): string => {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
};

const decodeCursor = (raw: string): ReactCursorPayload => {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const payload = JSON.parse(decoded) as ReactCursorPayload;
    if (
      payload.v !== 1
      || typeof payload.tool !== 'string'
      || typeof payload.deviceId !== 'string'
      || !Number.isInteger(payload.offset)
      || payload.offset < 0
      || typeof payload.filtersHash !== 'string'
    ) {
      throw new Error('Invalid cursor payload');
    }

    return payload;
  } catch {
    throw new Error('Invalid "cursor". Run the command again without cursor to restart pagination.');
  }
};

const normalizeLimit = (value: unknown): number => {
  if (value === undefined) {
    return DEFAULT_SEARCH_LIMIT;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`"limit" must be an integer between 1 and ${MAX_SEARCH_LIMIT}`);
  }

  return Math.min(parsed, MAX_SEARCH_LIMIT);
};

const normalizeMatch = (value: unknown): 'name' | 'name-or-key' => {
  if (value === 'name-or-key') {
    return 'name-or-key';
  }

  return 'name';
};

const normalizeNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`"${name}" must be a non-negative integer`);
  }

  return Number(value);
};

const normalizeSlowRenderThreshold = (value: unknown): number => {
  if (value === undefined) {
    return DEFAULT_SLOW_RENDER_THRESHOLD_MS;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('"slowRenderThresholdMs" must be a non-negative number');
  }

  return parsed;
};

const normalizeWaitForDataMs = (value: unknown): number => {
  if (value === undefined) {
    return DEFAULT_STOP_PROFILING_WAIT_MS;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`"waitForDataMs" must be a number between 0 and ${MAX_STOP_PROFILING_WAIT_MS}`);
  }

  return Math.min(parsed, MAX_STOP_PROFILING_WAIT_MS);
};

const normalizeRenderDataSort = (value: unknown): ReactRenderDataSort => {
  if (value === 'name-asc') {
    return 'name-asc';
  }

  return 'duration-desc';
};

const delay = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const ensureNodeSummary = (node: ReactNodeRecord): ReactNodeSummary => {
  return {
    nodeId: node.nodeId,
    displayName: node.displayName,
    elementType: node.elementType,
    ...(node.key !== undefined ? { key: node.key } : {}),
    childCount: node.childIds.length,
    ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
  };
};

const getNodeId = (value: unknown): number => {
  if (!Number.isInteger(value)) {
    throw new Error('"nodeId" must be an integer');
  }

  return Number(value);
};

const ensureNodeExists = (state: DeviceReactTreeState, nodeId: number): ReactNodeRecord => {
  const node = state.nodesById.get(nodeId);
  if (!node) {
    throw new Error(`Node "${nodeId}" no longer exists in the current React tree.`);
  }

  return node;
};

const createSerializableSnapshot = (
  value: unknown,
  depth = 3,
  seen = new Set<unknown>(),
): unknown => {
  if (
    value === null
    || typeof value === 'boolean'
    || typeof value === 'number'
    || typeof value === 'string'
  ) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'undefined') {
    return '[undefined]';
  }

  if (typeof value === 'function') {
    return '[function]';
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (seen.has(value)) {
    return '[circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    if (depth <= 0) {
      return `[array(${value.length})]`;
    }
    return value.slice(0, 50).map((item) => createSerializableSnapshot(item, depth - 1, seen));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('data' in record && 'cleaned' in record && Object.keys(record).length <= 5) {
      return createSerializableSnapshot(record.data, depth, seen);
    }

    if (depth <= 0) {
      return '[object]';
    }

    const entries = Object.entries(record).slice(0, 100);
    return Object.fromEntries(
      entries.map(([key, nested]) => [key, createSerializableSnapshot(nested, depth - 1, seen)] as const),
    );
  }

  return String(value);
};

const toInspectableEntries = (value: unknown): Array<{ name: string; value: unknown }> => {
  const snapshot = createSerializableSnapshot(value);
  if (Array.isArray(snapshot)) {
    return snapshot.map((entry, index) => ({
      name: String(index),
      value: entry,
    }));
  }

  if (snapshot && typeof snapshot === 'object') {
    return Object.entries(snapshot as Record<string, unknown>).map(([name, entryValue]) => ({
      name,
      value: entryValue,
    }));
  }

  return [{
    name: 'value',
    value: snapshot,
  }];
};

const toHookEntries = (value: unknown): Array<{ name: string; value: unknown }> => {
  const entries: Array<{ name: string; value: unknown }> = [];

  const visit = (current: unknown, pathLabel: string): void => {
    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        const nextLabel = pathLabel.length > 0 ? `${pathLabel}.${index}` : String(index);
        visit(item, nextLabel);
      });
      return;
    }

    if (current && typeof current === 'object') {
      const record = current as Record<string, unknown>;
      const hookName = typeof record.name === 'string' ? record.name : undefined;
      const label = hookName
        ? `${pathLabel || 'value'} (${hookName})`
        : (pathLabel || 'value');
      const hookValue = 'value' in record
        ? createSerializableSnapshot(record.value, 6)
        : createSerializableSnapshot(record, 6);

      entries.push({
        name: label,
        value: hookValue,
      });

      if (Array.isArray(record.subHooks)) {
        record.subHooks.forEach((subHook, index) => {
          const subLabel = pathLabel.length > 0
            ? `${pathLabel}.subHooks.${index}`
            : `subHooks.${index}`;
          visit(subHook, subLabel);
        });
      }
      return;
    }

    entries.push({
      name: pathLabel || 'value',
      value: createSerializableSnapshot(current, 6),
    });
  };

  visit(value, '');
  return entries;
};

const normalizePath = (value: unknown): Array<string | number> => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error('"path" must be an array of strings and integers');
  }

  const path: Array<string | number> = [];
  for (const segment of value) {
    if (typeof segment === 'string') {
      path.push(segment);
      continue;
    }
    if (Number.isInteger(segment)) {
      path.push(Number(segment));
      continue;
    }

    throw new Error('"path" must be an array of strings and integers');
  }

  return path;
};

const getValueAtPath = (root: unknown, path: Array<string | number>): unknown => {
  let current: unknown = root;
  for (const segment of path) {
    if (current === null || current === undefined) {
      throw new Error(`Path segment "${String(segment)}" does not exist.`);
    }

    if (typeof segment === 'number') {
      if (!Array.isArray(current)) {
        throw new Error(`Path segment "${segment}" expects an array.`);
      }
      current = current[segment];
      continue;
    }

    if (typeof current !== 'object' || Array.isArray(current)) {
      throw new Error(`Path segment "${segment}" expects an object.`);
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};

const parseInspectedElementEvent = (message: {
  event: string;
  payload: unknown;
}): { nodeId: number; props?: unknown; state?: unknown; hooks?: unknown } | null => {
  if (message.event !== 'inspectedElement') {
    return null;
  }

  const payload = getRecord(message.payload);
  if (!payload) {
    return null;
  }

  const nodeId = Number.isInteger(payload.id) ? Number(payload.id) : undefined;
  if (nodeId === undefined) {
    return null;
  }

  if (payload.type === 'not-found') {
    return {
      nodeId,
      props: undefined,
      state: undefined,
    };
  }

  const source = getRecord(payload.value) || payload;
  return {
    nodeId,
    ...(source.props !== undefined ? { props: source.props } : {}),
    ...(source.state !== undefined ? { state: source.state } : {}),
    ...(source.hooks !== undefined ? { hooks: source.hooks } : {}),
  };
};

const toReactNodeRecord = (node: ReactTreeNodeInput): ReactNodeRecord => {
  const childIds = (node.childIds || [])
    .filter((childId: unknown) => Number.isInteger(childId))
    .map((childId: unknown) => Number(childId))
    .sort((a: number, b: number) => a - b);

  return {
    nodeId: node.nodeId,
    displayName: node.displayName,
    elementType: node.elementType,
    ...(node.key !== undefined ? { key: node.key } : {}),
    ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
    ...(node.rendererId !== undefined ? { rendererId: node.rendererId } : {}),
    childCount: childIds.length,
    childIds,
  };
};

export const createReactTreeStore = (
  options?: {
    createBridge?: (options?: {
      sendMessage?: (message: { event: string; payload: unknown }) => void;
    }) => Promise<ReactDevToolsBridge>;
  },
) => {
  const createBridge = options?.createBridge ?? createReactDevToolsBridge;
  const states = new Map<string, DeviceReactTreeState>();

  const getOrCreateState = (deviceId: string): DeviceReactTreeState => {
    const existing = states.get(deviceId);
    if (existing) {
      return existing;
    }

    const created: DeviceReactTreeState = {
      rootIds: [],
      nodesById: new Map(),
      inspectedById: new Map(),
      bridge: null,
      bridgePromise: null,
      pendingMessages: [],
      droppedPendingMessages: 0,
      pendingInspectionsByNodeId: new Map(),
      nextInspectRequestId: 1,
    };
    states.set(deviceId, created);
    return created;
  };

  const registerDevice = (
    deviceId: string,
    options?: {
      sendMessage?: (message: { event: string; payload: unknown }) => void;
    },
  ): void => {
    const state = getOrCreateState(deviceId);
    state.sendMessage = options?.sendMessage;
    // Eagerly initialize bridge/store on device connect to reduce race windows
    // for early capability/status reads right after DevTools session starts.
    void ensureBridge(state).catch(() => {
      // Keep registration non-failing; tool calls will retry and surface errors if needed.
    });
  };

  const unregisterDevice = (deviceId: string): void => {
    states.delete(deviceId);
  };

  const syncTree = (deviceId: string, payload: ReactTreeSyncPayload): void => {
    const state = getOrCreateState(deviceId);

    const roots = Array.isArray(payload.roots) ? payload.roots : [];
    const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];

    const rootIds = roots
      .filter((rootId) => Number.isInteger(rootId))
      .map((rootId) => Number(rootId))
      .sort((a, b) => a - b);

    const nodesById = new Map<number, ReactNodeRecord>();
    for (const node of nodes) {
      if (!Number.isInteger(node.nodeId)) {
        continue;
      }
      const record = toReactNodeRecord(node);
      nodesById.set(record.nodeId, record);
    }

    state.rootIds = rootIds.filter((rootId) => nodesById.has(rootId));
    state.nodesById = nodesById;
    // Tree-sync snapshots replace current topology; invalidate stale inspected snapshots.
    state.inspectedById.clear();
  };

  const ensureBridge = async (
    state: DeviceReactTreeState,
  ): Promise<ReactDevToolsBridge> => {
    if (state.bridge) {
      return state.bridge;
    }

    if (!state.bridgePromise) {
      state.bridgePromise = createBridge({
        sendMessage: state.sendMessage,
      }).then((bridge) => {
        state.bridge = bridge;
        return bridge;
      }).catch((error) => {
        state.bridgePromise = null;
        throw error;
      });
    }

    return state.bridgePromise;
  };

  const ingestReactDevToolsMessage = (
    deviceId: string,
    message: ReactDevToolsBridgeMessage | unknown,
  ): Promise<void> => {
    const record = getRecord(message);
    if (!record) {
      return Promise.resolve();
    }
    const state = getOrCreateState(deviceId);

    const event = typeof record.event === 'string' ? record.event : undefined;
    const payload = record.payload;

    if (!event) {
      return Promise.resolve();
    }

    const inspected = parseInspectedElementEvent({ event, payload });
    if (inspected) {
      if (
        inspected.props === undefined
        && inspected.state === undefined
        && inspected.hooks === undefined
      ) {
        state.inspectedById.delete(inspected.nodeId);
        const pending = state.pendingInspectionsByNodeId.get(inspected.nodeId);
        if (pending) {
          state.pendingInspectionsByNodeId.delete(inspected.nodeId);
          for (const resolve of pending) {
            resolve(null);
          }
        }
      } else {
        const inspectedRecord: ReactInspectedNodeRecord = {
          ...(inspected.props !== undefined ? { props: inspected.props } : {}),
          ...(inspected.state !== undefined ? { state: inspected.state } : {}),
          ...(inspected.hooks !== undefined ? { hooks: inspected.hooks } : {}),
        };
        state.inspectedById.set(inspected.nodeId, inspectedRecord);
        const pending = state.pendingInspectionsByNodeId.get(inspected.nodeId);
        if (pending) {
          state.pendingInspectionsByNodeId.delete(inspected.nodeId);
          for (const resolve of pending) {
            resolve(inspectedRecord);
          }
        }
      }
    }

    if (state.pendingMessages.length >= MAX_PENDING_REACT_MESSAGES) {
      const overflow = state.pendingMessages.length - MAX_PENDING_REACT_MESSAGES + 1;
      state.pendingMessages.splice(0, overflow);
      state.droppedPendingMessages += overflow;
    }
    state.pendingMessages.push({ event, payload });

    return ensureBridge(state).then((bridge) => {
      while (state.pendingMessages.length > 0) {
        const next = state.pendingMessages.shift()!;
        const syncPayload = bridge.ingest(next);
        if (syncPayload) {
          syncTree(deviceId, syncPayload);
        }
      }
    });
  };

  const ensureProfilingBridge = async (state: DeviceReactTreeState): Promise<ReactDevToolsBridge> => {
    const bridge = await ensureBridge(state);
    const status = bridge.getProfilingStatus();
    if (!status.supportsProfiling && status.rootsCount > 0) {
      throw new Error('React profiling is not supported by this React DevTools connection.');
    }
    return bridge;
  };

  const isProfilingStarted = async (deviceId: string): Promise<ReactProfilingStatusResult> => {
    const state = getOrCreateState(deviceId);
    const bridge = await ensureBridge(state);
    const status = bridge.getProfilingStatus();

    return {
      isProfilingStarted: status.isProfilingStarted,
      isProcessingData: status.isProcessingData,
      hasProfilingData: status.hasProfilingData,
      rootsWithData: status.rootsWithData,
    };
  };

  const startProfiling = async (
    deviceId: string,
    rawRequest: unknown,
  ): Promise<ReactStartProfilingResult> => {
    const request = getRecord(rawRequest) || {};
    const shouldRestart = request.shouldRestart === true;
    const state = getOrCreateState(deviceId);
    const bridge = await ensureProfilingBridge(state);

    if (shouldRestart) {
      const status = bridge.getProfilingStatus();
      if (!status.supportsReloadAndProfile) {
        throw new Error('Reload-and-profile is not supported by this React DevTools connection.');
      }
      bridge.reloadAndProfile();
    } else {
      bridge.startProfiling();
    }

    const status = bridge.getProfilingStatus();
    return {
      ok: true,
      status: {
        isProfilingStarted: status.isProfilingStarted,
        isProcessingData: status.isProcessingData,
      },
    };
  };

  const waitForProfilingData = async (
    bridge: ReactDevToolsBridge,
    waitForDataMs: number,
  ): Promise<boolean> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < waitForDataMs) {
      if (!bridge.getProfilingStatus().isProcessingData) {
        return true;
      }
      await delay(50);
    }

    return !bridge.getProfilingStatus().isProcessingData;
  };

  const stopProfiling = async (
    deviceId: string,
    rawRequest: unknown,
  ): Promise<ReactStopProfilingResult> => {
    const request = getRecord(rawRequest) || {};
    const waitForDataMs = normalizeWaitForDataMs(request.waitForDataMs);
    const slowRenderThresholdMs = normalizeSlowRenderThreshold(request.slowRenderThresholdMs);
    const state = getOrCreateState(deviceId);
    const bridge = await ensureProfilingBridge(state);
    const statusBeforeStop = bridge.getProfilingStatus();

    if (statusBeforeStop.isProfilingStarted) {
      bridge.stopProfiling();
    }

    const finished = await waitForProfilingData(bridge, waitForDataMs);
    const status = bridge.getProfilingStatus();
    const profilingData = bridge.getProfilingDataSnapshot() as {
      phase?: string;
      dataForRoots?: Map<number, { commitData?: Array<{ duration: number; timestamp: number }> }>;
      conflictingRootIds?: Set<number>;
      participatingRendererIds?: Set<number>;
      pendingRendererIds?: Set<number>;
      receivedRendererIds?: Set<number>;
    } | null;
    const dataForRoots = profilingData?.dataForRoots ?? new Map<number, { commitData?: Array<{ duration: number; timestamp: number }> }>();
    const conflictingRootCount = profilingData?.conflictingRootIds?.size ?? 0;
    const receivedRendererCount = profilingData?.receivedRendererIds?.size ?? 0;
    const pendingRendererCount = profilingData?.pendingRendererIds?.size ?? 0;

    const roots = Array.from(dataForRoots.keys()).sort((a, b) => a - b);
    let totalCommits = 0;
    let totalRenderDurationMs = 0;
    let slowCount = 0;
    const slowCommits: Array<{ rootId: number; commitIndex: number; durationMs: number; timestampMs: number }> = [];

    dataForRoots.forEach((rootData, rootId) => {
      const commitData = Array.isArray(rootData.commitData) ? rootData.commitData : [];
      totalCommits += commitData.length;
      for (let index = 0; index < commitData.length; index += 1) {
        const commit = commitData[index];
        const durationMs = Number(commit.duration) || 0;
        totalRenderDurationMs += durationMs;
        if (durationMs > slowRenderThresholdMs) {
          slowCount += 1;
          slowCommits.push({
            rootId,
            commitIndex: index,
            durationMs,
            timestampMs: Number(commit.timestamp) || 0,
          });
        }
      }
    });

    slowCommits.sort((a, b) => b.durationMs - a.durationMs || a.timestampMs - b.timestampMs);
    const truncated = slowCommits.length > TOP_SLOW_COMMITS_LIMIT;
    const partial = !finished || pendingRendererCount > 0 || receivedRendererCount === 0 || conflictingRootCount > 0;

    return {
      session: {
        roots,
        totalCommits,
        totalRenderDurationMs,
      },
      renders: {
        count: totalCommits,
        slowCount,
        slowThresholdMs: slowRenderThresholdMs,
      },
      topSlowCommits: slowCommits.slice(0, TOP_SLOW_COMMITS_LIMIT),
      truncated,
      ...(partial ? { partial: true } : {}),
      ...(status.isProcessingData ? { isProcessingData: true } : {}),
    };
  };

  const getSearchCandidates = (
    state: DeviceReactTreeState,
    rootId: number | undefined,
  ): ReactNodeRecord[] => {
    const visited = new Set<number>();
    const queue: number[] = [];
    const orderedNodes: ReactNodeRecord[] = [];

    if (rootId !== undefined) {
      const root = state.nodesById.get(rootId);
      if (!root) {
        throw new Error(`Node "${rootId}" no longer exists in the current React tree.`);
      }
      queue.push(rootId);
    } else {
      queue.push(...state.rootIds);
    }

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const node = state.nodesById.get(currentId);
      if (!node) {
        continue;
      }

      orderedNodes.push(node);
      queue.push(...node.childIds);
    }

    return orderedNodes;
  };

  const searchNodes = (deviceId: string, rawRequest: unknown): ReactSearchNodesResult => {
    const request = getRecord(rawRequest) || {};
    const state = getOrCreateState(deviceId);

    const rawQuery = request.query;
    if (typeof rawQuery !== 'string' || rawQuery.trim().length === 0) {
      throw new Error('"query" must be a non-empty string');
    }
    const query = rawQuery.trim().toLowerCase();

    const rootId = Number.isInteger(request.rootId) ? Number(request.rootId) : undefined;
    const match = normalizeMatch(request.match);
    const limit = normalizeLimit(request.limit);

    const filtersHash = hashFilters({
      query,
      rootId,
      match,
    });

    let offset = 0;
    if (typeof request.cursor === 'string' && request.cursor.trim().length > 0) {
      const decoded = decodeCursor(request.cursor);
      if (
        decoded.deviceId !== deviceId
        || decoded.tool !== SEARCH_TOOL_NAME
        || decoded.filtersHash !== filtersHash
      ) {
        throw new Error('Cursor does not match this request context. Restart pagination without cursor.');
      }
      offset = decoded.offset;
    }

    const candidates = getSearchCandidates(state, rootId);
    const matched = candidates.filter((node) => {
      const nameMatches = node.displayName.toLowerCase().includes(query);
      if (nameMatches) {
        return true;
      }

      if (match === 'name-or-key' && node.key !== undefined) {
        return String(node.key).toLowerCase().includes(query);
      }

      return false;
    });

    const safeOffset = Math.max(0, Math.min(offset, matched.length));
    const end = Math.min(safeOffset + limit, matched.length);
    const items = matched.slice(safeOffset, end).map(ensureNodeSummary);
    const hasMore = end < matched.length;
    const nextCursor = hasMore
      ? encodeCursor({
        v: 1,
        tool: SEARCH_TOOL_NAME,
        deviceId,
        offset: end,
        filtersHash,
      })
      : undefined;

    return {
      items,
      page: {
        limit,
        hasMore,
        ...(nextCursor ? { nextCursor } : {}),
      },
    };
  };

  const getNode = (deviceId: string, rawRequest: unknown): ReactNodeSummary => {
    const request = getRecord(rawRequest) || {};
    const state = getOrCreateState(deviceId);
    const nodeId = getNodeId(request.nodeId);
    const node = ensureNodeExists(state, nodeId);
    return ensureNodeSummary(node);
  };

  const getChildren = (deviceId: string, rawRequest: unknown): ReactGetChildrenResult => {
    const request = getRecord(rawRequest) || {};
    const state = getOrCreateState(deviceId);
    const nodeId = getNodeId(request.nodeId);
    const node = ensureNodeExists(state, nodeId);
    const limit = normalizeLimit(request.limit);
    const filtersHash = hashFilters({ nodeId });

    let offset = 0;
    if (typeof request.cursor === 'string' && request.cursor.trim().length > 0) {
      const decoded = decodeCursor(request.cursor);
      if (
        decoded.deviceId !== deviceId
        || decoded.tool !== GET_CHILDREN_TOOL_NAME
        || decoded.filtersHash !== filtersHash
      ) {
        throw new Error('Cursor does not match this request context. Restart pagination without cursor.');
      }
      offset = decoded.offset;
    }

    const children = node.childIds
      .map((childId) => state.nodesById.get(childId))
      .filter((child): child is ReactNodeRecord => Boolean(child));
    const safeOffset = Math.max(0, Math.min(offset, children.length));
    const end = Math.min(safeOffset + limit, children.length);
    const items = children.slice(safeOffset, end).map(ensureNodeSummary);
    const hasMore = end < children.length;
    const nextCursor = hasMore
      ? encodeCursor({
        v: 1,
        tool: GET_CHILDREN_TOOL_NAME,
        deviceId,
        offset: end,
        filtersHash,
      })
      : undefined;

    return {
      items,
      page: {
        limit,
        hasMore,
        ...(nextCursor ? { nextCursor } : {}),
      },
    };
  };

  const requestInspectableSnapshot = async (
    state: DeviceReactTreeState,
    nodeId: number,
  ): Promise<ReactInspectedNodeRecord | null> => {
    if (!state.sendMessage) {
      throw new Error(
        'React DevTools outbound channel is unavailable for this device. Re-open React Native DevTools and try again.',
      );
    }

    const node = ensureNodeExists(state, nodeId);
    if (!Number.isInteger(node.rendererId)) {
      throw new Error(`Node "${nodeId}" is missing renderer metadata required for inspection.`);
    }

    const bridge = await ensureBridge(state);

    return new Promise<ReactInspectedNodeRecord | null>((resolve) => {
      const waiters = state.pendingInspectionsByNodeId.get(nodeId) || [];
      waiters.push(resolve);
      state.pendingInspectionsByNodeId.set(nodeId, waiters);

      bridge.send('inspectElement', {
        forceFullData: true,
        id: nodeId,
        path: null,
        rendererID: node.rendererId,
        requestID: state.nextInspectRequestId++,
      });

      setTimeout(() => {
        const pending = state.pendingInspectionsByNodeId.get(nodeId);
        if (!pending) {
          return;
        }

        const index = pending.indexOf(resolve);
        if (index !== -1) {
          pending.splice(index, 1);
        }
        if (pending.length === 0) {
          state.pendingInspectionsByNodeId.delete(nodeId);
        } else {
          state.pendingInspectionsByNodeId.set(nodeId, pending);
        }
        resolve(null);
      }, INSPECT_WAIT_TIMEOUT_MS);
    });
  };

  const getInspectableEntries = async (
    deviceId: string,
    rawRequest: unknown,
    kind: 'props' | 'state' | 'hooks',
  ): Promise<ReactGetInspectableResult> => {
    const request = getRecord(rawRequest) || {};
    const state = getOrCreateState(deviceId);
    const nodeId = getNodeId(request.nodeId);
    ensureNodeExists(state, nodeId);
    const path = kind === 'hooks' ? normalizePath(request.path) : [];

    let inspected = state.inspectedById.get(nodeId);
    let sourceValue = kind === 'props'
      ? inspected?.props
      : kind === 'state'
        ? inspected?.state
        : inspected?.hooks;
    if (sourceValue === undefined) {
      const requested = await requestInspectableSnapshot(state, nodeId);
      inspected = requested || state.inspectedById.get(nodeId);
      sourceValue = kind === 'props'
        ? inspected?.props
        : kind === 'state'
          ? inspected?.state
          : inspected?.hooks;
      if (sourceValue === undefined) {
        throw new Error(
          `No ${kind} snapshot available for node "${nodeId}". React DevTools did not return inspected data for this node.`,
        );
      }
    }

    const scopedValue = path.length > 0 ? getValueAtPath(sourceValue, path) : sourceValue;
    const limit = normalizeLimit(request.limit);
    const filtersHash = hashFilters({ nodeId, kind, path });
    const toolName = kind === 'props'
      ? GET_PROPS_TOOL_NAME
      : kind === 'state'
        ? GET_STATE_TOOL_NAME
        : GET_HOOKS_TOOL_NAME;
    let offset = 0;
    if (typeof request.cursor === 'string' && request.cursor.trim().length > 0) {
      const decoded = decodeCursor(request.cursor);
      if (
        decoded.deviceId !== deviceId
        || decoded.tool !== toolName
        || decoded.filtersHash !== filtersHash
      ) {
        throw new Error('Cursor does not match this request context. Restart pagination without cursor.');
      }
      offset = decoded.offset;
    }

    const entries = kind === 'hooks'
      ? toHookEntries(scopedValue)
      : toInspectableEntries(scopedValue);
    const safeOffset = Math.max(0, Math.min(offset, entries.length));
    const end = Math.min(safeOffset + limit, entries.length);
    const items = entries.slice(safeOffset, end);
    const hasMore = end < entries.length;
    const nextCursor = hasMore
      ? encodeCursor({
        v: 1,
        tool: toolName,
        deviceId,
        offset: end,
        filtersHash,
      })
      : undefined;

    return {
      items,
      page: {
        limit,
        hasMore,
        ...(nextCursor ? { nextCursor } : {}),
      },
    };
  };

  const toChangeTypeHints = (changeDescription: ReactChangeDescription): string[] => {
    const hints: string[] = [];

    if (changeDescription.isFirstMount) {
      hints.push('mount');
    }
    if (Array.isArray(changeDescription.props) && changeDescription.props.length > 0) {
      hints.push('props');
    }
    if (Array.isArray(changeDescription.state) && changeDescription.state.length > 0) {
      hints.push('state');
    }
    if (
      changeDescription.context === true
      || (Array.isArray(changeDescription.context) && changeDescription.context.length > 0)
    ) {
      hints.push('context');
    }
    if (changeDescription.didHooksChange) {
      hints.push('hooks');
    }

    return hints;
  };

  const getRenderData = async (
    deviceId: string,
    rawRequest: unknown,
  ): Promise<ReactGetRenderDataResult> => {
    const request = getRecord(rawRequest) || {};
    const rootId = normalizeNonNegativeInteger(request.rootId, 'rootId');
    const commitIndex = normalizeNonNegativeInteger(request.commitIndex, 'commitIndex');
    const limit = normalizeLimit(request.limit);
    const sort = normalizeRenderDataSort(request.sort);
    const slowRenderThresholdMs = normalizeSlowRenderThreshold(request.slowRenderThresholdMs);

    const state = getOrCreateState(deviceId);
    const bridge = await ensureProfilingBridge(state);
    const commitData = bridge.getCommitData(rootId, commitIndex) as ReactCommitData;
    const fiberActualDurations = commitData.fiberActualDurations ?? new Map<number, number>();
    const fiberSelfDurations = commitData.fiberSelfDurations ?? new Map<number, number>();
    const changeDescriptions = commitData.changeDescriptions ?? new Map();

    const filtersHash = hashFilters({
      rootId,
      commitIndex,
      sort,
      slowRenderThresholdMs,
    });
    let offset = 0;
    if (typeof request.cursor === 'string' && request.cursor.trim().length > 0) {
      const decoded = decodeCursor(request.cursor) as ReactProfilingCursorPayload;
      if (
        decoded.deviceId !== deviceId
        || decoded.tool !== GET_RENDER_DATA_TOOL_NAME
        || decoded.filtersHash !== filtersHash
      ) {
        throw new Error('Cursor does not match this request context. Restart pagination without cursor.');
      }
      offset = decoded.offset;
    }

    const allItems: Array<ReactRenderDataItem & { sortName: string }> = [];
    fiberActualDurations.forEach((actualDurationMs, fiberId) => {
      const selfDurationMs = fiberSelfDurations.get(fiberId) ?? 0;
      const rawChangeDescription = changeDescriptions instanceof Map
        ? changeDescriptions.get(fiberId)
        : null;
      const changeTypeHints = rawChangeDescription ? toChangeTypeHints(rawChangeDescription) : [];
      const displayName = state.nodesById.get(fiberId)?.displayName ?? `Fiber ${fiberId}`;
      allItems.push({
        fiberId,
        actualDurationMs: Number(actualDurationMs) || 0,
        selfDurationMs: Number(selfDurationMs) || 0,
        isSlow: (Number(actualDurationMs) || 0) > slowRenderThresholdMs,
        ...(changeTypeHints.length > 0 ? { changeTypeHints } : {}),
        sortName: displayName.toLowerCase(),
      });
    });

    if (sort === 'name-asc') {
      allItems.sort((a, b) => a.sortName.localeCompare(b.sortName) || a.fiberId - b.fiberId);
    } else {
      allItems.sort((a, b) => b.actualDurationMs - a.actualDurationMs || a.fiberId - b.fiberId);
    }

    const safeOffset = Math.max(0, Math.min(offset, allItems.length));
    const end = Math.min(safeOffset + limit, allItems.length);
    const pageItems = allItems.slice(safeOffset, end).map((item) => {
      const { sortName, ...rest } = item;
      void sortName;
      return rest;
    });
    const hasMore = end < allItems.length;
    const nextCursor = hasMore
      ? encodeCursor({
        v: 1,
        tool: GET_RENDER_DATA_TOOL_NAME,
        deviceId,
        offset: end,
        filtersHash,
      })
      : undefined;

    return {
      commit: {
        rootId,
        commitIndex,
        durationMs: Number(commitData.duration) || 0,
        effectDurationMs: commitData.effectDuration ?? null,
        passiveEffectDurationMs: commitData.passiveEffectDuration ?? null,
        timestampMs: Number(commitData.timestamp) || 0,
        priorityLevel: commitData.priorityLevel ?? null,
      },
      summary: {
        renderedFiberCount: allItems.length,
        slowFiberCount: allItems.filter((item) => item.isSlow).length,
        slowRenderThresholdMs,
        updaterCount: Array.isArray(commitData.updaters) ? commitData.updaters.length : 0,
        hasChangeDescriptions: commitData.changeDescriptions !== null,
      },
      items: pageItems,
      page: {
        limit,
        hasMore,
        ...(nextCursor ? { nextCursor } : {}),
      },
    };
  };

  return {
    registerDevice,
    unregisterDevice,
    syncTree,
    ingestReactDevToolsMessage,
    startProfiling,
    isProfilingStarted,
    stopProfiling,
    getRenderData,
    searchNodes,
    getNode,
    getChildren,
    getProps: (deviceId: string, rawRequest: unknown): Promise<ReactGetInspectableResult> => {
      return getInspectableEntries(deviceId, rawRequest, 'props');
    },
    getState: (deviceId: string, rawRequest: unknown): Promise<ReactGetInspectableResult> => {
      return getInspectableEntries(deviceId, rawRequest, 'state');
    },
    getHooks: (deviceId: string, rawRequest: unknown): Promise<ReactGetInspectableResult> => {
      return getInspectableEntries(deviceId, rawRequest, 'hooks');
    },
  };
};
