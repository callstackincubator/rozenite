export interface ReactNodeSummary {
  nodeId: number;
  label: string;
  displayName: string;
  elementType: string;
  key?: string;
  childCount: number;
  parentId?: number;
  parentLabel?: string;
  /** Errors React logged against this component. Omitted when zero. */
  errorCount?: number;
  /** Warnings React logged against this component. Omitted when zero. */
  warningCount?: number;
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
  errorCount?: number;
  warningCount?: number;
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
  errorCount?: number;
  warningCount?: number;
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

export interface ReactGetErrorsResult {
  items: ReactNodeSummary[];
  totalCount: number;
  summary: {
    /** Components carrying at least one error or warning. */
    nodeCount: number;
    totalErrors: number;
    totalWarnings: number;
  };
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

export type ReactProfileTimelineSort = 'timeline' | 'duration-desc';

export interface ReactProfileTimelineItem {
  rootId: number;
  commitIndex: number;
  durationMs: number;
  timestampMs: number;
  renderedFiberCount: number;
  isSlow: boolean;
  /**
   * Time spent in layout effects for this commit, and in passive effects
   * flushed after it. React only measures these when the renderer supports it,
   * so both are null rather than 0 when the backend did not report them — a
   * commit that is quick to render can still be slow to commit.
   */
  effectDurationMs: number | null;
  passiveEffectDurationMs: number | null;
  /** React scheduler priority for the commit, when the backend reports one. */
  priorityLevel: string | null;
  /** How many fibers scheduled the update that produced this commit. */
  updaterCount: number;
  /** Whether getRenderData can explain why fibers rendered in this commit. */
  hasChangeDescriptions: boolean;
}

export interface ReactGetProfileTimelineResult {
  items: ReactProfileTimelineItem[];
  totalCount: number;
  summary: {
    roots: number[];
    totalCommits: number;
    totalRenderDurationMs: number;
    slowCommitCount: number;
    slowRenderThresholdMs: number;
    /** Roots left out because their data arrived from more than one renderer. */
    skippedRootIds?: number[];
  };
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

export type ReactComponentRendersSort =
  | 'total-duration-desc'
  | 'avg-duration-desc'
  | 'max-duration-desc'
  | 'render-count-desc'
  | 'name-asc';

export interface ReactComponentRenderItem {
  rootId: number;
  fiberId: number;
  /** `@cN` when the fiber is still mounted in the current tree. */
  label?: string;
  /** Falls back to `Fiber <id>` for fibers that unmounted before the read. */
  displayName: string;
  renderCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
  maxDurationMs: number;
  totalSelfDurationMs: number;
  slowRenderCount: number;
  /** Commit whose `actualDuration` for this fiber was the highest. */
  slowestCommitIndex: number;
  /** Union of the reasons React gave across every commit this fiber rendered in. */
  changeTypeHints?: string[];
  /** Union of the specific changed keys behind `changeTypeHints`. */
  changedKeys?: ReactRenderDataChangedKeys;
}

export interface ReactGetComponentRendersResult {
  items: ReactComponentRenderItem[];
  totalCount: number;
  summary: {
    roots: number[];
    totalCommits: number;
    renderedFiberCount: number;
    slowRenderThresholdMs: number;
    hasChangeDescriptions: boolean;
  };
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}
