export interface ReactNodeSummary {
  nodeId: number;
  displayName: string;
  elementType: string;
  key?: string;
  childCount: number;
  parentId?: number;
}

export interface ReactNodeRecord extends ReactNodeSummary {
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

export interface ReactGetChildrenResult {
  items: ReactNodeSummary[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
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
  topSlowCommits: ReactSlowCommitSummary[];
  truncated: boolean;
  partial?: boolean;
  isProcessingData?: boolean;
}

export type ReactRenderDataSort = 'duration-desc' | 'name-asc';

export interface ReactRenderDataItem {
  fiberId: number;
  actualDurationMs: number;
  selfDurationMs: number;
  isSlow: boolean;
  changeTypeHints?: string[];
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
