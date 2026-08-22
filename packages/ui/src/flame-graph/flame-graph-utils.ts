export type FlameGraphNode = {
  /** Stable identity. Falls back to a generated path key when omitted. */
  id?: string;
  /** Frame label. */
  name: string;
  /** Total time/size of this frame, including children. */
  value: number;
  /** Value attributable to this frame alone. Defaults to value minus the sum of children. */
  selfValue?: number;
  /** Longer description shown on hover. Defaults to `name`. */
  tooltip?: string;
  children?: FlameGraphNode[];
};

export type FlameGraphFrame = {
  key: string;
  node: FlameGraphNode;
  depth: number;
  /** Horizontal offset within the focused subtree, 0-100. */
  left: number;
  /** Width within the focused subtree, 0-100. */
  width: number;
  selfValue: number;
  /** `selfValue` relative to the largest self value in the tree, 0-1. */
  heat: number;
};

export type FlameGraphHeatBucket = 'none' | 'light' | 'moderate' | 'heavy' | 'heaviest';

/** `node.selfValue`, or `value` minus the sum of direct children's `value`. Never negative. */
export function getSelfValue(node: FlameGraphNode): number {
  if (node.selfValue !== undefined) {
    return Math.max(0, node.selfValue);
  }

  const childrenTotal = (node.children ?? []).reduce((sum, child) => sum + child.value, 0);
  return Math.max(0, node.value - childrenTotal);
}

/**
 * A stable, unique key for a node: `id` when present, otherwise a path built
 * from the parent's key and this node's index among its siblings. `null`
 * `parentKey` marks the root, whose fallback key ignores `index`.
 */
export function getFrameKey(node: FlameGraphNode, parentKey: string | null, index: number): string {
  if (node.id !== undefined) {
    return node.id;
  }

  return parentKey === null ? `0:${node.name}` : `${parentKey}/${index}:${node.name}`;
}

/** The largest `getSelfValue` anywhere in the tree, used to normalize heat. */
export function findMaxSelfValue(node: FlameGraphNode): number {
  let max = getSelfValue(node);

  for (const child of node.children ?? []) {
    max = Math.max(max, findMaxSelfValue(child));
  }

  return max;
}

/** Buckets a 0-1 heat value into the five tiers `FlameGraph` colors frames by. */
export function getHeatBucket(heat: number): FlameGraphHeatBucket {
  if (heat > 0.7) {
    return 'heaviest';
  }

  if (heat > 0.4) {
    return 'heavy';
  }

  if (heat > 0.2) {
    return 'moderate';
  }

  if (heat > 0) {
    return 'light';
  }

  return 'none';
}

/** Tailwind classes for each heat bucket, token-backed so both themes stay readable. */
export const heatBucketClassName: Record<FlameGraphHeatBucket, string> = {
  heaviest: 'bg-danger text-danger-foreground',
  heavy: 'bg-warning text-warning-foreground',
  moderate: 'bg-info text-info-foreground',
  light: 'bg-success text-success-foreground',
  none: 'bg-muted text-muted-foreground',
};

/**
 * Classes for a frame that a `highlight` search pushed into the background.
 *
 * The background alpha is lowered rather than the whole element's `opacity`,
 * which would fade the label with it and leave the frame unreadable. Keeping
 * a washed-out version of the heat color (instead of flattening everything to
 * grey) means the graph's shape and rough weighting survive the search.
 */
export const heatBucketMutedClassName: Record<FlameGraphHeatBucket, string> = {
  heaviest: 'bg-danger/20 text-muted-foreground',
  heavy: 'bg-warning/20 text-muted-foreground',
  moderate: 'bg-info/20 text-muted-foreground',
  light: 'bg-success/20 text-muted-foreground',
  none: 'bg-muted/40 text-muted-foreground',
};

/**
 * Whether a frame matches a `highlight` search term, case-insensitively.
 *
 * Both the label and the `tooltip` are searched: the label is often only a
 * basename, so matching it alone would miss path queries that callers
 * reasonably expect to work (and that any accompanying list view, filtering
 * on the full path, would match).
 */
export function matchesHighlight(node: FlameGraphNode, highlight: string | undefined): boolean {
  if (!highlight) {
    return true;
  }

  const needle = highlight.toLowerCase();

  return (
    node.name.toLowerCase().includes(needle) ||
    (node.tooltip?.toLowerCase().includes(needle) ?? false)
  );
}

export type LayoutFlameGraphOptions = {
  /** Key of the node to zoom into. `null`/omitted renders the whole tree. */
  focusedKey?: string | null;
  /** Frames narrower than this percentage width are culled along with their descendants. @default 0 */
  minFrameWidth?: number;
};

export type LayoutFlameGraphResult = {
  frames: FlameGraphFrame[];
  depthCount: number;
  /** The node matching `focusedKey`, or `null` when unfocused/not found. */
  focusedNode: FlameGraphNode | null;
};

type PathEntry = { node: FlameGraphNode; key: string; depth: number };

function findPath(node: FlameGraphNode, targetKey: string): PathEntry[] | null {
  return findPathFrom(node, null, 0, 0, targetKey);
}

function findPathFrom(
  node: FlameGraphNode,
  parentKey: string | null,
  index: number,
  depth: number,
  targetKey: string,
): PathEntry[] | null {
  const key = getFrameKey(node, parentKey, index);

  if (key === targetKey) {
    return [{ node, key, depth }];
  }

  for (const [childIndex, child] of (node.children ?? []).entries()) {
    const childPath = findPathFrom(child, key, childIndex, depth + 1, targetKey);

    if (childPath) {
      return [{ node, key, depth }, ...childPath];
    }
  }

  return null;
}

type LayoutContext = {
  frames: FlameGraphFrame[];
  minFrameWidth: number;
  maxSelfValue: number;
  maxDepth: number;
};

function pushFrame(
  ctx: LayoutContext,
  node: FlameGraphNode,
  key: string,
  depth: number,
  left: number,
  width: number,
): void {
  const selfValue = getSelfValue(node);
  ctx.frames.push({
    key,
    node,
    depth,
    left,
    width,
    selfValue,
    heat: ctx.maxSelfValue > 0 ? selfValue / ctx.maxSelfValue : 0,
  });
  ctx.maxDepth = Math.max(ctx.maxDepth, depth);
}

// Positions every node as a fraction of a single, fixed `total` (the value of
// the subtree root) so siblings line up by absolute value and gaps under a
// parent (its self time) show through as blank space — the standard
// flame-graph "icicle" layout.
function layoutScaled(
  ctx: LayoutContext,
  node: FlameGraphNode,
  key: string,
  depth: number,
  offset: number,
  total: number,
): void {
  const left = (offset / total) * 100;
  const width = (node.value / total) * 100;

  if (width < ctx.minFrameWidth) {
    return;
  }

  pushFrame(ctx, node, key, depth, left, width);

  let childOffset = offset;
  (node.children ?? []).forEach((child, index) => {
    const childKey = getFrameKey(child, key, index);
    layoutScaled(ctx, child, childKey, depth + 1, childOffset, total);
    childOffset += child.value;
  });
}

// Fallback for an all-zero-value subtree, where `layoutScaled` would divide
// by zero: siblings split their parent's width evenly at every level, so the
// tree's shape stays visible even without any value to size frames by.
function layoutEven(
  ctx: LayoutContext,
  node: FlameGraphNode,
  key: string,
  depth: number,
  left: number,
  width: number,
): void {
  if (width < ctx.minFrameWidth) {
    return;
  }

  pushFrame(ctx, node, key, depth, left, width);

  const children = node.children ?? [];
  if (children.length === 0) {
    return;
  }

  const childWidth = width / children.length;
  children.forEach((child, index) => {
    const childKey = getFrameKey(child, key, index);
    layoutEven(ctx, child, childKey, depth + 1, left + index * childWidth, childWidth);
  });
}

/**
 * Flattens a `FlameGraphNode` tree into positioned, culled frames ready to
 * render. When `focusedKey` names a non-root node, its ancestors are kept as
 * full-width rows above it (so the call stack leading to it stays visible)
 * and its own subtree is rescaled to fill the full width.
 */
export function layoutFlameGraph(
  root: FlameGraphNode | null,
  options: LayoutFlameGraphOptions = {},
): LayoutFlameGraphResult {
  if (!root) {
    return { frames: [], depthCount: 0, focusedNode: null };
  }

  const { focusedKey = null, minFrameWidth = 0 } = options;
  const path = focusedKey ? findPath(root, focusedKey) : null;
  const ancestors = path ? path.slice(0, -1) : [];
  const focusedEntry = path ? path[path.length - 1] : null;
  const focusedNode = focusedEntry ? focusedEntry.node : null;

  const ctx: LayoutContext = {
    frames: [],
    minFrameWidth,
    maxSelfValue: findMaxSelfValue(root),
    maxDepth: 0,
  };

  for (const ancestor of ancestors) {
    pushFrame(ctx, ancestor.node, ancestor.key, ancestor.depth, 0, 100);
  }

  const subtreeRoot = focusedNode ?? root;
  const subtreeKey = focusedEntry ? focusedEntry.key : getFrameKey(root, null, 0);
  const subtreeDepth = ancestors.length;

  if (subtreeRoot.value > 0) {
    layoutScaled(ctx, subtreeRoot, subtreeKey, subtreeDepth, 0, subtreeRoot.value);
  } else {
    layoutEven(ctx, subtreeRoot, subtreeKey, subtreeDepth, 0, 100);
  }

  return { frames: ctx.frames, depthCount: ctx.maxDepth + 1, focusedNode };
}
