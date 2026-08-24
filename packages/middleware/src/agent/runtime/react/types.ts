export interface ReactNodeSummary {
  nodeId: number;
  label: string;
  displayName: string;
  elementType: string;
  key?: string;
  childCount: number;
  parentId?: number;
  parentLabel?: string;
}

export interface ReactNodeRecord {
  nodeId: number;
  displayName: string;
  elementType: string;
  key?: string;
  childCount: number;
  parentId?: number;
  childIds: number[];
  rendererId?: number;
}

export interface ReactInspectedNodeRecord {
  props?: unknown;
  state?: unknown;
  hooks?: unknown;
}

export interface ReactTreeNodeInput {
  nodeId: number;
  displayName: string;
  elementType: string;
  key?: string;
  parentId?: number;
  rendererId?: number;
  childIds?: number[];
}

export interface ReactTreeSyncPayload {
  roots: number[];
  nodes: ReactTreeNodeInput[];
}

export interface ReactDevToolsBridgeMessage {
  event?: string;
  payload?: unknown;
}

export interface ReactSearchNodesResult {
  items: ReactNodeSummary[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

export interface ReactTreeNode extends ReactNodeSummary {
  childIds: number[];
  depth: number;
}

export interface ReactGetTreeResult {
  roots: number[];
  items: ReactTreeNode[];
  totalCount: number;
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

export interface ReactGetChildrenResult {
  items: ReactNodeSummary[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

export type ReactComponentSection = 'props' | 'state' | 'hooks';

export interface ReactGetComponentResult {
  node: ReactNodeSummary & {
    childIds: number[];
    rendererId?: number;
  };
  props?: unknown;
  state?: unknown;
  hooks?: unknown;
  partial?: boolean;
  unavailable?: ReactComponentSection[];
}

export interface ReactInspectableEntry {
  name: string;
  value: unknown;
}

export interface ReactGetInspectableResult {
  items: ReactInspectableEntry[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

export interface ReactStartProfilingResult {
  ok: true;
  status: {
    isProfilingStarted: boolean;
    isProcessingData: boolean;
  };
}

export interface ReactProfilingStatusResult {
  isProfilingStarted: boolean;
  isProcessingData: boolean;
  hasProfilingData: boolean;
  rootsWithData: number;
}

export interface ReactSlowCommitSummary {
  rootId: number;
  commitIndex: number;
  durationMs: number;
  timestampMs: number;
}

export interface ReactCommitSummary extends ReactSlowCommitSummary {
  effectDurationMs: number | null;
  passiveEffectDurationMs: number | null;
  priorityLevel: string | null;
  renderedFiberCount: number;
  updaterCount: number;
  hasChangeDescriptions: boolean;
}

export interface ReactStopProfilingResult {
  session: {
    roots: number[];
    totalCommits: number;
    totalRenderDurationMs: number;
  };
  renders: {
    count: number;
    slowCount: number;
    slowThresholdMs: number;
  };
  commits: ReactCommitSummary[];
  topSlowCommits: ReactSlowCommitSummary[];
  truncated: boolean;
  partial?: boolean;
  isProcessingData?: boolean;
}

export type ReactRenderDataSort = 'duration-desc' | 'name-asc';

export interface ReactRenderDataChangedKeys {
  /** True when this fiber rendered for the first time (initial mount). */
  isFirstMount?: true;
  /** Names of the props that changed. */
  props?: string[];
  /** Names of the state keys that changed (class components / useState). */
  state?: string[];
  /**
   * Context that changed: `true` when React only reported that some context
   * changed, or the list of context display names when available.
   */
  context?: string[] | true;
  /** True when at least one hook value changed. */
  hooks?: true;
}

export interface ReactRenderDataItem {
  fiberId: number;
  /** Resolved component display name, or `Fiber <id>` when unknown. */
  displayName: string;
  actualDurationMs: number;
  selfDurationMs: number;
  isSlow: boolean;
  changeTypeHints?: string[];
  /**
   * The specific changed keys behind `changeTypeHints`: the exact prop / state /
   * context key names plus hooks/mount flags. Present only when React recorded
   * change descriptions for this fiber (updates observed while profiling).
   */
  changedKeys?: ReactRenderDataChangedKeys;
}

export interface ReactGetRenderDataResult {
  commit: {
    rootId: number;
    commitIndex: number;
    durationMs: number;
    effectDurationMs: number | null;
    passiveEffectDurationMs: number | null;
    timestampMs: number;
    priorityLevel: string | null;
  };
  summary: {
    renderedFiberCount: number;
    slowFiberCount: number;
    slowRenderThresholdMs: number;
    updaterCount: number;
    hasChangeDescriptions: boolean;
  };
  items: ReactRenderDataItem[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

export interface ReactProfilingCursorPayload {
  v: 1;
  tool: string;
  deviceId: string;
  offset: number;
  filtersHash: string;
}
