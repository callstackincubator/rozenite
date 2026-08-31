import { paginateReactList } from './pagination.js';
import type { ReactChangeDescription, ReactCommitData } from './profiling-store.js';
import type {
  ReactComponentSection,
  ReactDevToolsBridgeMessage,
  ReactGetChildrenResult,
  ReactGetComponentResult,
  ReactGetInspectableResult,
  ReactComponentRenderItem,
  ReactComponentRendersSort,
  ReactGetComponentRendersResult,
  ReactGetErrorsResult,
  ReactGetProfileTimelineResult,
  ReactGetRenderDataResult,
  ReactGetTreeResult,
  ReactInspectedNodeRecord,
  ReactProfileTimelineItem,
  ReactProfileTimelineSort,
  ReactProfilingStatusResult,
  ReactRenderDataChangedKeys,
  ReactRenderDataItem,
  ReactRenderDataSort,
  ReactNodeRecord,
  ReactNodeSummary,
  ReactSearchNodesResult,
  ReactStartProfilingResult,
  ReactStopProfilingResult,
  ReactTreeNode,
  ReactTreeNodeInput,
  ReactTreeSyncPayload,
} from './types.js';
import { createReactDevToolsBridge, type ReactDevToolsBridge } from './react-devtools-bridge.js';

const GET_TREE_TOOL_NAME = 'getTree';
const SEARCH_TOOL_NAME = 'searchNodes';
const GET_CHILDREN_TOOL_NAME = 'getChildren';
const DEFAULT_COMPONENT_VALUE_DEPTH = 4;
const MAX_COMPONENT_VALUE_DEPTH = 8;
/**
 * Wide enough to leave ordinary strings — URLs, messages, ids — intact, and
 * narrow enough that one base64 image or serialised blob cannot dominate a
 * response. `valueDepth` bounds nesting; this bounds the other axis.
 */
const DEFAULT_MAX_VALUE_LENGTH = 512;
const MAX_MAX_VALUE_LENGTH = 8192;
const GET_PROPS_TOOL_NAME = 'getProps';
const GET_STATE_TOOL_NAME = 'getState';
const GET_HOOKS_TOOL_NAME = 'getHooks';
const GET_RENDER_DATA_TOOL_NAME = 'getRenderData';
const GET_ERRORS_TOOL_NAME = 'getErrors';
const GET_PROFILE_TIMELINE_TOOL_NAME = 'getProfileTimeline';
const GET_COMPONENT_RENDERS_TOOL_NAME = 'getComponentRenders';
const INSPECT_WAIT_TIMEOUT_MS = 2000;
const DEFAULT_STOP_PROFILING_WAIT_MS = 3000;
const MAX_STOP_PROFILING_WAIT_MS = 10000;
const DEFAULT_SLOW_RENDER_THRESHOLD_MS = 16;
const TOP_SLOW_COMMITS_LIMIT = 10;
const MAX_PENDING_REACT_MESSAGES = 1000;

/**
 * Collapse a React change description into a short list of category hints
 * ("mount" | "props" | "state" | "context" | "hooks") describing WHY a fiber
 * re-rendered in a commit.
 */
export const toChangeTypeHints = (changeDescription: ReactChangeDescription): string[] => {
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
    changeDescription.context === true ||
    (Array.isArray(changeDescription.context) && changeDescription.context.length > 0)
  ) {
    hints.push('context');
  }
  if (changeDescription.didHooksChange) {
    hints.push('hooks');
  }

  return hints;
};

/**
 * Expand a React change description into the specific changed keys behind the
 * hints: the exact prop / state / context key names, plus hooks/mount flags.
 * Returns `undefined` when nothing meaningful changed (so the field can be
 * omitted from the response).
 */
export const toChangedKeys = (
  changeDescription: ReactChangeDescription | null | undefined,
): ReactRenderDataChangedKeys | undefined => {
  if (!changeDescription) {
    return undefined;
  }

  const changed: ReactRenderDataChangedKeys = {};

  if (changeDescription.isFirstMount) {
    changed.isFirstMount = true;
  }
  if (Array.isArray(changeDescription.props) && changeDescription.props.length > 0) {
    changed.props = changeDescription.props;
  }
  if (Array.isArray(changeDescription.state) && changeDescription.state.length > 0) {
    changed.state = changeDescription.state;
  }
  if (changeDescription.context === true) {
    changed.context = true;
  } else if (Array.isArray(changeDescription.context) && changeDescription.context.length > 0) {
    changed.context = changeDescription.context;
  }
  if (changeDescription.didHooksChange) {
    changed.hooks = true;
  }

  return Object.keys(changed).length > 0 ? changed : undefined;
};

type DeviceReactTreeState = {
  rootIds: number[];
  nodesById: Map<number, ReactNodeRecord>;
  labelByNodeId: Map<number, string>;
  nodeIdByLabel: Map<string, number>;
  inspectedById: Map<number, ReactInspectedNodeRecord>;
  bridge: ReactDevToolsBridge | null;
  bridgePromise: Promise<ReactDevToolsBridge> | null;
  pendingMessages: Array<{ event: string; payload: unknown }>;
  droppedPendingMessages: number;
  sendMessage?: (message: { event: string; payload: unknown }) => void;
  pendingInspectionsByNodeId: Map<
    number,
    Array<(inspected: ReactInspectedNodeRecord | null) => void>
  >;
  nextInspectRequestId: number;
};

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const normalizeDepth = (value: unknown): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error('"depth" must be a non-negative integer');
  }

  return parsed;
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

const COMPONENT_RENDERS_SORTS: readonly ReactComponentRendersSort[] = [
  'total-duration-desc',
  'avg-duration-desc',
  'max-duration-desc',
  'render-count-desc',
  'name-asc',
];

const normalizeComponentRendersSort = (value: unknown): ReactComponentRendersSort => {
  if (value === undefined) {
    return 'total-duration-desc';
  }

  const match = COMPONENT_RENDERS_SORTS.find((sort) => sort === value);
  if (!match) {
    throw new Error(`"sort" must be one of ${COMPONENT_RENDERS_SORTS.join(', ')}`);
  }

  return match;
};

const compareComponentRenders = (
  sort: ReactComponentRendersSort,
): ((
  a: ReactComponentRenderItem & { sortName: string },
  b: ReactComponentRenderItem & { sortName: string },
) => number) => {
  const tieBreak = (
    a: ReactComponentRenderItem & { sortName: string },
    b: ReactComponentRenderItem & { sortName: string },
  ): number => a.rootId - b.rootId || a.fiberId - b.fiberId;

  switch (sort) {
    case 'avg-duration-desc':
      return (a, b) => b.avgDurationMs - a.avgDurationMs || tieBreak(a, b);
    case 'max-duration-desc':
      return (a, b) => b.maxDurationMs - a.maxDurationMs || tieBreak(a, b);
    case 'render-count-desc':
      return (a, b) => b.renderCount - a.renderCount || tieBreak(a, b);
    case 'name-asc':
      return (a, b) => a.sortName.localeCompare(b.sortName) || tieBreak(a, b);
    case 'total-duration-desc':
      return (a, b) => b.totalDurationMs - a.totalDurationMs || tieBreak(a, b);
  }
};

const roundMs = (value: number): number => Math.round(value * 1000) / 1000;

const mergeStringSets = (current: string[] | undefined, incoming: string[]): string[] => {
  if (incoming.length === 0) {
    return current ?? [];
  }

  return [...new Set([...(current ?? []), ...incoming])];
};

/**
 * Union two change descriptions from different commits of the same fiber.
 *
 * `context` carries two shapes from React: the literal `true` when it only
 * reported that some context changed, or the names when it knew them. `true`
 * loses to a name list, since "context changed, and here is which" is strictly
 * more than "context changed".
 */
const mergeChangedKeys = (
  current: ReactRenderDataChangedKeys | undefined,
  incoming: ReactRenderDataChangedKeys | undefined,
): ReactRenderDataChangedKeys | undefined => {
  if (!incoming) {
    return current;
  }
  if (!current) {
    return incoming;
  }

  const merged: ReactRenderDataChangedKeys = {};

  if (current.isFirstMount || incoming.isFirstMount) {
    merged.isFirstMount = true;
  }
  if (current.props || incoming.props) {
    merged.props = mergeStringSets(current.props, incoming.props ?? []);
  }
  if (current.state || incoming.state) {
    merged.state = mergeStringSets(current.state, incoming.state ?? []);
  }
  if (Array.isArray(current.context) || Array.isArray(incoming.context)) {
    merged.context = mergeStringSets(
      Array.isArray(current.context) ? current.context : undefined,
      Array.isArray(incoming.context) ? incoming.context : [],
    );
  } else if (current.context === true || incoming.context === true) {
    merged.context = true;
  }
  if (current.hooks || incoming.hooks) {
    merged.hooks = true;
  }

  return merged;
};

const normalizeComponentSections = (value: unknown): ReactComponentSection[] => {
  const defaultSections: ReactComponentSection[] = ['props', 'state', 'hooks'];
  if (value === undefined) {
    return defaultSections;
  }

  if (!Array.isArray(value)) {
    throw new Error('"include" must be an array of props, state, or hooks');
  }

  const sections: ReactComponentSection[] = [];
  for (const entry of value) {
    if (entry !== 'props' && entry !== 'state' && entry !== 'hooks') {
      throw new Error('"include" must contain only props, state, or hooks');
    }
    if (!sections.includes(entry)) {
      sections.push(entry);
    }
  }

  if (sections.length === 0) {
    throw new Error('"include" must contain at least one section');
  }

  return sections;
};

const normalizeComponentValueDepth = (value: unknown): number => {
  if (value === undefined) {
    return DEFAULT_COMPONENT_VALUE_DEPTH;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`"valueDepth" must be an integer between 0 and ${MAX_COMPONENT_VALUE_DEPTH}`);
  }

  return Math.min(parsed, MAX_COMPONENT_VALUE_DEPTH);
};

const normalizeMaxValueLength = (value: unknown): number => {
  if (value === undefined) {
    return DEFAULT_MAX_VALUE_LENGTH;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`"maxValueLength" must be an integer between 1 and ${MAX_MAX_VALUE_LENGTH}`);
  }

  return Math.min(parsed, MAX_MAX_VALUE_LENGTH);
};

const normalizeBoolean = (value: unknown, name: string): boolean => {
  if (value === undefined) {
    return false;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`"${name}" must be a boolean`);
  }

  return value;
};

const delay = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

/**
 * A host node worth keeping even when `noHost` filtering is on.
 *
 * A host stops being interchangeable structure once something identifies it: a
 * `key` React itself needed to tell siblings apart, a hyphenated custom element
 * name, or a logged error or warning that is the whole reason someone is
 * reading the tree.
 *
 * Note that this filter usually has nothing to do: React DevTools' backend
 * hides host components by default (`getDefaultComponentFilters` in
 * `react-devtools-core`) and Rozenite never overrides that, so host fibers
 * normally never reach this store. It earns its keep only when a DevTools
 * frontend sharing the same backend has turned host components back on.
 */
const isSignificantHost = (node: ReactNodeRecord): boolean => {
  return (
    node.key !== undefined ||
    node.displayName.includes('-') ||
    (node.errorCount ?? 0) > 0 ||
    (node.warningCount ?? 0) > 0
  );
};

const isHiddenHost = (node: ReactNodeRecord, noHost: boolean): boolean => {
  return noHost && node.elementType === 'host' && !isSignificantHost(node);
};

const ensureNodeSummary = (node: ReactNodeRecord): ReactNodeSummary => {
  return {
    nodeId: node.nodeId,
    label: '@c?',
    displayName: node.displayName,
    elementType: node.elementType,
    ...(node.key !== undefined ? { key: node.key } : {}),
    childCount: node.childIds.length,
    ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
    ...((node.errorCount ?? 0) > 0 ? { errorCount: node.errorCount } : {}),
    ...((node.warningCount ?? 0) > 0 ? { warningCount: node.warningCount } : {}),
  };
};

const ensureNodeSummaryForState = (
  state: DeviceReactTreeState,
  node: ReactNodeRecord,
  /**
   * Parent and children as seen through the caller's filter, replacing the real
   * ones outright — a `parentId` pointing at a node the same call filtered out
   * would be worse than none. Omitted by tools that report a node on its own,
   * where the real React parent is the honest answer.
   */
  visible?: {
    parentId?: number;
    childIds: number[];
  },
): ReactNodeSummary => {
  const { parentId: realParentId, ...summary } = ensureNodeSummary(node);
  const parentId = visible ? visible.parentId : realParentId;
  const parentLabel = parentId !== undefined ? state.labelByNodeId.get(parentId) : undefined;

  return {
    ...summary,
    label: state.labelByNodeId.get(node.nodeId) ?? '@c?',
    ...(visible ? { childCount: visible.childIds.length } : {}),
    ...(parentId !== undefined ? { parentId } : {}),
    ...(parentLabel !== undefined ? { parentLabel } : {}),
  };
};

const ensureTreeNode = (
  state: DeviceReactTreeState,
  node: ReactNodeRecord,
  options: {
    depth: number;
    parentId?: number;
    childIds: number[];
  },
): ReactTreeNode => {
  return {
    ...ensureNodeSummaryForState(state, node, {
      ...(options.parentId !== undefined ? { parentId: options.parentId } : {}),
      childIds: options.childIds,
    }),
    childIds: options.childIds,
    depth: options.depth,
  };
};

const resolveNodeId = (state: DeviceReactTreeState, value: unknown, fieldName: string): number => {
  if (Number.isInteger(value)) {
    return Number(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^@c\d+$/.test(trimmed)) {
      const nodeId = state.nodeIdByLabel.get(trimmed);
      if (nodeId === undefined) {
        throw new Error(`Component label "${trimmed}" no longer exists in the current React tree.`);
      }

      return nodeId;
    }

    const parsed = Number(trimmed);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  throw new Error(`"${fieldName}" must be an integer or component label like "@c12"`);
};

/**
 * Profiling outlives the tree: a fiber that unmounted before the read still has
 * timings worth reporting, so it falls back to an ID rather than disappearing.
 */
const resolveFiberDisplayName = (state: DeviceReactTreeState, fiberId: number): string => {
  return state.nodesById.get(fiberId)?.displayName ?? `Fiber ${fiberId}`;
};

const ensureNodeExists = (state: DeviceReactTreeState, nodeId: number): ReactNodeRecord => {
  const node = state.nodesById.get(nodeId);
  if (!node) {
    throw new Error(`Node "${nodeId}" no longer exists in the current React tree.`);
  }

  return node;
};

const getOptionalRootId = (value: unknown): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value)) {
    throw new Error('"root" must be an integer node ID');
  }

  return Number(value);
};

const getRequestedNodeId = (
  state: DeviceReactTreeState,
  request: Record<string, unknown>,
): number => {
  return resolveNodeId(
    state,
    request.id !== undefined ? request.id : request.nodeId,
    request.id !== undefined ? 'id' : 'nodeId',
  );
};

const createSerializableSnapshot = (
  value: unknown,
  depth = 3,
  maxValueLength = DEFAULT_MAX_VALUE_LENGTH,
  seen = new Set<unknown>(),
): unknown => {
  if (typeof value === 'string') {
    return value.length > maxValueLength
      ? `${value.slice(0, maxValueLength)}[+${value.length - maxValueLength} chars]`
      : value;
  }

  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
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
    return value
      .slice(0, 50)
      .map((item) => createSerializableSnapshot(item, depth - 1, maxValueLength, seen));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('data' in record && 'cleaned' in record && Object.keys(record).length <= 5) {
      return createSerializableSnapshot(record.data, depth, maxValueLength, seen);
    }

    if (depth <= 0) {
      return '[object]';
    }

    const entries = Object.entries(record).slice(0, 100);
    return Object.fromEntries(
      entries.map(
        ([key, nested]) =>
          [key, createSerializableSnapshot(nested, depth - 1, maxValueLength, seen)] as const,
      ),
    );
  }

  return String(value);
};

const toInspectableEntries = (
  value: unknown,
  maxValueLength: number,
): Array<{ name: string; value: unknown }> => {
  const snapshot = createSerializableSnapshot(value, DEFAULT_COMPONENT_VALUE_DEPTH, maxValueLength);
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

  return [
    {
      name: 'value',
      value: snapshot,
    },
  ];
};

const toHookEntries = (
  value: unknown,
  maxValueLength: number,
): Array<{ name: string; value: unknown }> => {
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
      const label = hookName ? `${pathLabel || 'value'} (${hookName})` : pathLabel || 'value';
      const hookValue =
        'value' in record
          ? createSerializableSnapshot(record.value, 6, maxValueLength)
          : createSerializableSnapshot(record, 6, maxValueLength);

      entries.push({
        name: label,
        value: hookValue,
      });

      if (Array.isArray(record.subHooks)) {
        record.subHooks.forEach((subHook, index) => {
          const subLabel =
            pathLabel.length > 0 ? `${pathLabel}.subHooks.${index}` : `subHooks.${index}`;
          visit(subHook, subLabel);
        });
      }
      return;
    }

    entries.push({
      name: pathLabel || 'value',
      value: createSerializableSnapshot(current, 6, maxValueLength),
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
}): {
  nodeId: number;
  props?: unknown;
  state?: unknown;
  hooks?: unknown;
} | null => {
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
    ...(node.errorCount !== undefined ? { errorCount: node.errorCount } : {}),
    ...(node.warningCount !== undefined ? { warningCount: node.warningCount } : {}),
    childCount: childIds.length,
    childIds,
  };
};

export const createReactTreeStore = (options?: {
  createBridge?: (options?: {
    sendMessage?: (message: { event: string; payload: unknown }) => void;
  }) => Promise<ReactDevToolsBridge>;
}) => {
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
      labelByNodeId: new Map(),
      nodeIdByLabel: new Map(),
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
    state.labelByNodeId.clear();
    state.nodeIdByLabel.clear();

    const visited = new Set<number>();
    let nextLabelIndex = 1;
    const assignLabels = (nodeId: number): void => {
      if (visited.has(nodeId)) {
        return;
      }
      const node = nodesById.get(nodeId);
      if (!node) {
        return;
      }

      visited.add(nodeId);
      const label = `@c${nextLabelIndex++}`;
      state.labelByNodeId.set(nodeId, label);
      state.nodeIdByLabel.set(label, nodeId);

      for (const childId of node.childIds) {
        assignLabels(childId);
      }
    };

    for (const rootId of state.rootIds) {
      assignLabels(rootId);
    }

    state.inspectedById.clear();
  };

  const ensureBridge = async (state: DeviceReactTreeState): Promise<ReactDevToolsBridge> => {
    if (state.bridge) {
      return state.bridge;
    }

    if (!state.bridgePromise) {
      state.bridgePromise = createBridge({
        sendMessage: state.sendMessage,
      })
        .then((bridge) => {
          state.bridge = bridge;
          return bridge;
        })
        .catch((error) => {
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
        inspected.props === undefined &&
        inspected.state === undefined &&
        inspected.hooks === undefined
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

  const ensureProfilingBridge = async (
    state: DeviceReactTreeState,
  ): Promise<ReactDevToolsBridge> => {
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

    if (
      !statusBeforeStop.isProfilingStarted &&
      !statusBeforeStop.isProcessingData &&
      !statusBeforeStop.hasProfilingData
    ) {
      throw new Error('No active profiling session for this session');
    }

    if (statusBeforeStop.isProfilingStarted) {
      bridge.stopProfiling();
    }

    const finished = await waitForProfilingData(bridge, waitForDataMs);
    const status = bridge.getProfilingStatus();
    const profilingData = bridge.getProfilingDataSnapshot();
    const dataForRoots = profilingData.dataForRoots;
    const conflictingRootCount = profilingData.conflictingRootIds.size;
    const receivedRendererCount = profilingData.receivedRendererIds.size;
    const pendingRendererCount = profilingData.pendingRendererIds.size;

    const roots = Array.from(dataForRoots.keys()).sort((a, b) => a - b);
    let totalCommits = 0;
    let totalRenderDurationMs = 0;
    let slowCount = 0;
    const slowCommits: Array<{
      rootId: number;
      commitIndex: number;
      durationMs: number;
      timestampMs: number;
    }> = [];

    dataForRoots.forEach((rootData, rootId) => {
      const commitData = rootData.commitData;
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
    const partial =
      !finished ||
      pendingRendererCount > 0 ||
      receivedRendererCount === 0 ||
      conflictingRootCount > 0;

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

  /**
   * A node's children as the caller's filter sees them: each hidden host is
   * replaced by its own first visible descendants, so the list stays consistent
   * with what `getTree` emits under the same flag.
   */
  const getVisibleChildIds = (
    state: DeviceReactTreeState,
    node: ReactNodeRecord,
    noHost: boolean,
    seen = new Set<number>(),
  ): number[] => {
    const visible: number[] = [];

    for (const childId of node.childIds) {
      if (seen.has(childId)) {
        continue;
      }
      seen.add(childId);

      const child = state.nodesById.get(childId);
      if (!child) {
        continue;
      }

      if (isHiddenHost(child, noHost)) {
        visible.push(...getVisibleChildIds(state, child, noHost, seen));
        continue;
      }

      visible.push(childId);
    }

    return visible;
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

    const rootId =
      request.rootId !== undefined ? resolveNodeId(state, request.rootId, 'rootId') : undefined;
    const match = normalizeMatch(request.match);
    const noHost = normalizeBoolean(request.noHost, 'noHost');

    const matched = getSearchCandidates(state, rootId).filter((node) => {
      if (isHiddenHost(node, noHost)) {
        return false;
      }

      if (node.displayName.toLowerCase().includes(query)) {
        return true;
      }

      if (match === 'name-or-key' && node.key !== undefined) {
        return String(node.key).toLowerCase().includes(query);
      }

      return false;
    });

    const { items, page } = paginateReactList({
      deviceId,
      tool: SEARCH_TOOL_NAME,
      filters: { query, rootId, match, noHost },
      limit: request.limit,
      cursor: request.cursor,
      items: matched,
    });

    return {
      items: items.map((node) => ensureNodeSummaryForState(state, node)),
      page,
    };
  };

  const getTree = (deviceId: string, rawRequest: unknown): ReactGetTreeResult => {
    const request = getRecord(rawRequest) || {};
    const state = getOrCreateState(deviceId);
    const rootId = getOptionalRootId(request.root);
    const depth = normalizeDepth(request.depth);
    const noHost = normalizeBoolean(request.noHost, 'noHost');

    const traversalRoots =
      rootId === undefined
        ? state.rootIds.filter((id) => state.nodesById.has(id))
        : [ensureNodeExists(state, rootId).nodeId];

    const visited = new Set<number>();
    const allItems: ReactTreeNode[] = [];

    /**
     * Hidden nodes do not consume a level: their children are emitted against
     * the nearest visible ancestor, at that ancestor's depth + 1. `depth` and
     * `parentId` therefore describe the tree the caller is actually shown, so
     * following `childIds` from a page always lands on a node the same filter
     * would return.
     */
    const walk = (nodeId: number, currentDepth: number, visibleParentId?: number): void => {
      if (visited.has(nodeId)) {
        return;
      }

      const node = state.nodesById.get(nodeId);
      if (!node) {
        return;
      }

      // An explicitly requested root stays visible; scoping a subtree to a host
      // node and getting nothing back would be a strange way to answer.
      const hidden = nodeId !== rootId && isHiddenHost(node, noHost);
      if (hidden) {
        visited.add(nodeId);
        for (const childId of node.childIds) {
          walk(childId, currentDepth, visibleParentId);
        }
        return;
      }

      if (depth !== undefined && currentDepth > depth) {
        return;
      }

      visited.add(nodeId);
      allItems.push(
        ensureTreeNode(state, node, {
          depth: currentDepth,
          ...(visibleParentId !== undefined ? { parentId: visibleParentId } : {}),
          childIds: getVisibleChildIds(state, node, noHost),
        }),
      );

      for (const childId of node.childIds) {
        walk(childId, currentDepth + 1, nodeId);
      }
    };

    for (const traversalRoot of traversalRoots) {
      walk(traversalRoot, 0);
    }

    const { items, totalCount, page } = paginateReactList({
      deviceId,
      tool: GET_TREE_TOOL_NAME,
      filters: { rootId, depth, noHost },
      limit: request.limit,
      cursor: request.cursor,
      items: allItems,
    });

    return {
      roots: traversalRoots,
      items,
      totalCount,
      page,
    };
  };

  const getNode = (deviceId: string, rawRequest: unknown): ReactNodeSummary => {
    const request = getRecord(rawRequest) || {};
    const state = getOrCreateState(deviceId);
    const nodeId = getRequestedNodeId(state, request);
    const node = ensureNodeExists(state, nodeId);
    return ensureNodeSummaryForState(state, node);
  };

  const getChildren = (deviceId: string, rawRequest: unknown): ReactGetChildrenResult => {
    const request = getRecord(rawRequest) || {};
    const state = getOrCreateState(deviceId);
    const nodeId = getRequestedNodeId(state, request);
    const node = ensureNodeExists(state, nodeId);
    const noHost = normalizeBoolean(request.noHost, 'noHost');

    const children = getVisibleChildIds(state, node, noHost)
      .map((childId) => state.nodesById.get(childId))
      .filter((child): child is ReactNodeRecord => Boolean(child));

    const { items, page } = paginateReactList({
      deviceId,
      tool: GET_CHILDREN_TOOL_NAME,
      filters: { nodeId, noHost },
      limit: request.limit,
      cursor: request.cursor,
      items: children,
    });

    return {
      items: items.map((child) =>
        ensureNodeSummaryForState(state, child, {
          parentId: nodeId,
          childIds: getVisibleChildIds(state, child, noHost),
        }),
      ),
      page,
    };
  };

  const getErrors = (deviceId: string, rawRequest: unknown): ReactGetErrorsResult => {
    const request = getRecord(rawRequest) || {};
    const state = getOrCreateState(deviceId);
    const rootId =
      request.root !== undefined ? resolveNodeId(state, request.root, 'root') : undefined;

    const affected = getSearchCandidates(state, rootId)
      .filter((node) => (node.errorCount ?? 0) > 0 || (node.warningCount ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.errorCount ?? 0) - (a.errorCount ?? 0) ||
          (b.warningCount ?? 0) - (a.warningCount ?? 0) ||
          a.nodeId - b.nodeId,
      );

    const { items, totalCount, page } = paginateReactList({
      deviceId,
      tool: GET_ERRORS_TOOL_NAME,
      filters: { rootId },
      limit: request.limit,
      cursor: request.cursor,
      items: affected,
    });

    return {
      items: items.map((node) => ensureNodeSummaryForState(state, node)),
      totalCount,
      summary: {
        nodeCount: affected.length,
        totalErrors: affected.reduce((total, node) => total + (node.errorCount ?? 0), 0),
        totalWarnings: affected.reduce((total, node) => total + (node.warningCount ?? 0), 0),
      },
      page,
    };
  };

  const getInspectedRecord = async (
    state: DeviceReactTreeState,
    nodeId: number,
    sections: ReactComponentSection[],
  ): Promise<ReactInspectedNodeRecord | null> => {
    let inspected = state.inspectedById.get(nodeId);
    const hasAllRequestedSections = sections.every((section) => {
      return inspected?.[section] !== undefined;
    });

    if (!inspected || !hasAllRequestedSections) {
      inspected =
        (await requestInspectableSnapshot(state, nodeId)) || state.inspectedById.get(nodeId);
    }

    return inspected ?? null;
  };

  const getComponent = async (
    deviceId: string,
    rawRequest: unknown,
  ): Promise<ReactGetComponentResult> => {
    const request = getRecord(rawRequest) || {};
    const state = getOrCreateState(deviceId);
    const nodeId = getRequestedNodeId(state, request);
    const node = ensureNodeExists(state, nodeId);
    const sections = normalizeComponentSections(request.include);
    const valueDepth = normalizeComponentValueDepth(request.valueDepth);
    const maxValueLength = normalizeMaxValueLength(request.maxValueLength);
    const inspected = await getInspectedRecord(state, nodeId, sections);

    if (!inspected) {
      throw new Error(
        `No inspected snapshot available for node "${nodeId}". React DevTools did not return inspected data for this node.`,
      );
    }

    const unavailable: ReactComponentSection[] = [];
    const result: ReactGetComponentResult = {
      node: {
        ...ensureNodeSummaryForState(state, node),
        childIds: node.childIds.filter((childId) => state.nodesById.has(childId)),
        ...(node.rendererId !== undefined ? { rendererId: node.rendererId } : {}),
      },
    };

    for (const section of sections) {
      const value = inspected[section];
      if (value === undefined) {
        unavailable.push(section);
        continue;
      }

      result[section] = createSerializableSnapshot(value, valueDepth, maxValueLength);
    }

    if (unavailable.length === sections.length) {
      throw new Error(`No requested component snapshot sections available for node "${nodeId}".`);
    }
    if (unavailable.length > 0) {
      result.partial = true;
      result.unavailable = unavailable;
    }

    return result;
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
    const nodeId = getRequestedNodeId(state, request);
    ensureNodeExists(state, nodeId);
    const path = kind === 'hooks' ? normalizePath(request.path) : [];

    let inspected = state.inspectedById.get(nodeId);
    let sourceValue =
      kind === 'props' ? inspected?.props : kind === 'state' ? inspected?.state : inspected?.hooks;
    if (sourceValue === undefined) {
      const requested = await requestInspectableSnapshot(state, nodeId);
      inspected = requested || state.inspectedById.get(nodeId);
      sourceValue =
        kind === 'props'
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
    const maxValueLength = normalizeMaxValueLength(request.maxValueLength);
    const toolName =
      kind === 'props'
        ? GET_PROPS_TOOL_NAME
        : kind === 'state'
          ? GET_STATE_TOOL_NAME
          : GET_HOOKS_TOOL_NAME;

    const entries =
      kind === 'hooks'
        ? toHookEntries(scopedValue, maxValueLength)
        : toInspectableEntries(scopedValue, maxValueLength);

    const { items, page } = paginateReactList({
      deviceId,
      tool: toolName,
      filters: { nodeId, kind, path, maxValueLength },
      limit: request.limit,
      cursor: request.cursor,
      items: entries,
    });

    return { items, page };
  };

  const getRenderData = async (
    deviceId: string,
    rawRequest: unknown,
  ): Promise<ReactGetRenderDataResult> => {
    const request = getRecord(rawRequest) || {};
    const rootId = normalizeNonNegativeInteger(request.rootId, 'rootId');
    const commitIndex = normalizeNonNegativeInteger(request.commitIndex, 'commitIndex');
    const sort = normalizeRenderDataSort(request.sort);
    const slowRenderThresholdMs = normalizeSlowRenderThreshold(request.slowRenderThresholdMs);

    const state = getOrCreateState(deviceId);
    const bridge = await ensureProfilingBridge(state);
    const commitData = bridge.getCommitData(rootId, commitIndex);

    const allItems: Array<ReactRenderDataItem & { sortName: string }> = [];
    commitData.fiberActualDurations.forEach((actualDurationMs, fiberId) => {
      const changeDescription = commitData.changeDescriptions?.get(fiberId) ?? null;
      const changeTypeHints = changeDescription ? toChangeTypeHints(changeDescription) : [];
      const changedKeys = toChangedKeys(changeDescription);
      const displayName = resolveFiberDisplayName(state, fiberId);
      allItems.push({
        fiberId,
        displayName,
        actualDurationMs,
        selfDurationMs: commitData.fiberSelfDurations.get(fiberId) ?? 0,
        isSlow: actualDurationMs > slowRenderThresholdMs,
        ...(changeTypeHints.length > 0 ? { changeTypeHints } : {}),
        ...(changedKeys ? { changedKeys } : {}),
        sortName: displayName.toLowerCase(),
      });
    });

    if (sort === 'name-asc') {
      allItems.sort((a, b) => a.sortName.localeCompare(b.sortName) || a.fiberId - b.fiberId);
    } else {
      allItems.sort((a, b) => b.actualDurationMs - a.actualDurationMs || a.fiberId - b.fiberId);
    }

    const { items, page } = paginateReactList({
      deviceId,
      tool: GET_RENDER_DATA_TOOL_NAME,
      filters: { rootId, commitIndex, sort, slowRenderThresholdMs },
      limit: request.limit,
      cursor: request.cursor,
      items: allItems,
    });

    return {
      commit: {
        rootId,
        commitIndex,
        durationMs: commitData.duration,
        effectDurationMs: commitData.effectDuration,
        passiveEffectDurationMs: commitData.passiveEffectDuration,
        timestampMs: commitData.timestamp,
        priorityLevel: commitData.priorityLevel,
      },
      summary: {
        renderedFiberCount: allItems.length,
        slowFiberCount: allItems.filter((item) => item.isSlow).length,
        slowRenderThresholdMs,
        updaterCount: commitData.updaters?.length ?? 0,
        hasChangeDescriptions: commitData.changeDescriptions !== null,
      },
      items: items.map(({ sortName, ...item }) => {
        void sortName;
        return item;
      }),
      page,
    };
  };

  /**
   * Every commit of the session, in root then commit order, with the roots
   * whose data arrived from more than one renderer left out.
   *
   * `getCommitData` refuses those roots outright, because reading one commit
   * from an ambiguous root would quietly hand back the wrong renderer's numbers.
   * A whole-session view cannot refuse for the same reason without losing every
   * unambiguous root alongside it, so it drops them and says so in `skippedRootIds`.
   */
  const collectSessionCommits = async (
    deviceId: string,
    rootFilter: number | undefined,
  ): Promise<{
    roots: number[];
    skippedRootIds: number[];
    commits: Array<{ rootId: number; commitIndex: number; commit: ReactCommitData }>;
  }> => {
    const state = getOrCreateState(deviceId);
    const bridge = await ensureProfilingBridge(state);
    const snapshot = bridge.getProfilingDataSnapshot();

    if (snapshot.dataForRoots.size === 0) {
      throw new Error(
        'No React profiling data available. Run startProfiling and stopProfiling first.',
      );
    }

    const roots: number[] = [];
    const skippedRootIds: number[] = [];
    const commits: Array<{ rootId: number; commitIndex: number; commit: ReactCommitData }> = [];

    for (const rootId of [...snapshot.dataForRoots.keys()].sort((a, b) => a - b)) {
      if (rootFilter !== undefined && rootId !== rootFilter) {
        continue;
      }

      if (snapshot.conflictingRootIds.has(rootId)) {
        skippedRootIds.push(rootId);
        continue;
      }

      roots.push(rootId);
      const commitData = snapshot.dataForRoots.get(rootId)?.commitData ?? [];
      commitData.forEach((commit, commitIndex) => {
        commits.push({ rootId, commitIndex, commit });
      });
    }

    if (rootFilter !== undefined && roots.length === 0 && skippedRootIds.length === 0) {
      throw new Error(`No React profiling data available for root "${rootFilter}".`);
    }

    return { roots, skippedRootIds, commits };
  };

  const getProfileTimeline = async (
    deviceId: string,
    rawRequest: unknown,
  ): Promise<ReactGetProfileTimelineResult> => {
    const request = getRecord(rawRequest) || {};
    const rootId =
      request.rootId !== undefined
        ? normalizeNonNegativeInteger(request.rootId, 'rootId')
        : undefined;
    const sort: ReactProfileTimelineSort =
      request.sort === 'duration-desc' ? 'duration-desc' : 'timeline';
    const slowRenderThresholdMs = normalizeSlowRenderThreshold(request.slowRenderThresholdMs);

    const session = await collectSessionCommits(deviceId, rootId);

    const allItems: ReactProfileTimelineItem[] = session.commits.map(
      ({ rootId: commitRootId, commitIndex, commit }) => ({
        rootId: commitRootId,
        commitIndex,
        durationMs: commit.duration,
        timestampMs: commit.timestamp,
        renderedFiberCount: commit.fiberActualDurations.size,
        isSlow: commit.duration > slowRenderThresholdMs,
      }),
    );

    if (sort === 'duration-desc') {
      allItems.sort(
        (a, b) =>
          b.durationMs - a.durationMs || a.rootId - b.rootId || a.commitIndex - b.commitIndex,
      );
    }

    const { items, totalCount, page } = paginateReactList({
      deviceId,
      tool: GET_PROFILE_TIMELINE_TOOL_NAME,
      filters: { rootId, sort, slowRenderThresholdMs },
      limit: request.limit,
      cursor: request.cursor,
      items: allItems,
    });

    return {
      items,
      totalCount,
      summary: {
        roots: session.roots,
        totalCommits: allItems.length,
        totalRenderDurationMs: allItems.reduce((total, item) => total + item.durationMs, 0),
        slowCommitCount: allItems.filter((item) => item.isSlow).length,
        slowRenderThresholdMs,
        ...(session.skippedRootIds.length > 0 ? { skippedRootIds: session.skippedRootIds } : {}),
      },
      page,
    };
  };

  const getComponentRenders = async (
    deviceId: string,
    rawRequest: unknown,
  ): Promise<ReactGetComponentRendersResult> => {
    const request = getRecord(rawRequest) || {};
    const state = getOrCreateState(deviceId);
    const rootId =
      request.rootId !== undefined
        ? normalizeNonNegativeInteger(request.rootId, 'rootId')
        : undefined;
    const requestedFiber = request.id !== undefined ? request.id : request.fiberId;
    const fiberId =
      requestedFiber !== undefined
        ? resolveNodeId(state, requestedFiber, request.id !== undefined ? 'id' : 'fiberId')
        : undefined;
    const sort = normalizeComponentRendersSort(request.sort);
    const slowRenderThresholdMs = normalizeSlowRenderThreshold(request.slowRenderThresholdMs);

    const session = await collectSessionCommits(deviceId, rootId);

    // Keyed by root as well as fiber: fiber IDs are only unique within a
    // renderer, so merging two roots on ID alone would invent a component that
    // rendered in both.
    const aggregates = new Map<string, ReactComponentRenderItem & { sortName: string }>();

    for (const { rootId: commitRootId, commitIndex, commit } of session.commits) {
      commit.fiberActualDurations.forEach((actualDurationMs, currentFiberId) => {
        if (fiberId !== undefined && currentFiberId !== fiberId) {
          return;
        }

        const key = `${commitRootId}:${currentFiberId}`;
        let aggregate = aggregates.get(key);

        if (!aggregate) {
          const displayName = resolveFiberDisplayName(state, currentFiberId);
          aggregate = {
            rootId: commitRootId,
            fiberId: currentFiberId,
            ...(state.labelByNodeId.has(currentFiberId)
              ? { label: state.labelByNodeId.get(currentFiberId)! }
              : {}),
            displayName,
            renderCount: 0,
            totalDurationMs: 0,
            avgDurationMs: 0,
            maxDurationMs: 0,
            totalSelfDurationMs: 0,
            slowRenderCount: 0,
            slowestCommitIndex: commitIndex,
            sortName: displayName.toLowerCase(),
          };
          aggregates.set(key, aggregate);
        }

        aggregate.renderCount += 1;
        aggregate.totalDurationMs += actualDurationMs;
        aggregate.totalSelfDurationMs += commit.fiberSelfDurations.get(currentFiberId) ?? 0;
        if (actualDurationMs > aggregate.maxDurationMs) {
          aggregate.maxDurationMs = actualDurationMs;
          aggregate.slowestCommitIndex = commitIndex;
        }
        if (actualDurationMs > slowRenderThresholdMs) {
          aggregate.slowRenderCount += 1;
        }

        const changeDescription = commit.changeDescriptions?.get(currentFiberId);
        if (changeDescription) {
          aggregate.changeTypeHints = mergeStringSets(
            aggregate.changeTypeHints,
            toChangeTypeHints(changeDescription),
          );
          aggregate.changedKeys = mergeChangedKeys(
            aggregate.changedKeys,
            toChangedKeys(changeDescription),
          );
        }
      });
    }

    const allItems = [...aggregates.values()];
    for (const aggregate of allItems) {
      // Rounded because it is derived: 7/3 serialises to 2.3333333333333335,
      // which is seventeen characters of noise per row at microsecond precision
      // nothing measured here has.
      aggregate.avgDurationMs = roundMs(aggregate.totalDurationMs / aggregate.renderCount);
    }
    allItems.sort(compareComponentRenders(sort));

    const { items, totalCount, page } = paginateReactList({
      deviceId,
      tool: GET_COMPONENT_RENDERS_TOOL_NAME,
      filters: { rootId, fiberId, sort, slowRenderThresholdMs },
      limit: request.limit,
      cursor: request.cursor,
      items: allItems,
    });

    return {
      items: items.map(({ sortName, ...item }) => {
        void sortName;
        return item;
      }),
      totalCount,
      summary: {
        roots: session.roots,
        totalCommits: session.commits.length,
        renderedFiberCount: allItems.length,
        slowRenderThresholdMs,
        hasChangeDescriptions: session.commits.some(
          ({ commit }) => commit.changeDescriptions !== null,
        ),
        ...(session.skippedRootIds.length > 0 ? { skippedRootIds: session.skippedRootIds } : {}),
      },
      page,
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
    getTree,
    getComponent,
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
    getErrors,
    getProfileTimeline,
    getComponentRenders,
  };
};
