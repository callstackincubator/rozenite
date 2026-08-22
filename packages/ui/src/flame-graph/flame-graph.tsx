import { useMemo, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../utils/cn';
import { EmptyState } from '../empty-state/empty-state';
import { Text } from '../text/text';
import {
  getHeatBucket,
  heatBucketClassName,
  heatBucketMutedClassName,
  layoutFlameGraph,
  matchesHighlight,
  type FlameGraphFrame,
  type FlameGraphHeatBucket,
  type FlameGraphNode,
} from './flame-graph-utils';

export type { FlameGraphFrame, FlameGraphNode };

const DEFAULT_ROW_HEIGHT = 20;
const DEFAULT_MIN_FRAME_WIDTH = 0.08;
// Below this width there's no room for even a truncated label to be legible.
const MIN_LABEL_WIDTH_PERCENT = 3;

function defaultFormatValue(value: number): string {
  return String(value);
}

function hasRenderableData(data: FlameGraphNode | null): data is FlameGraphNode {
  if (!data) {
    return false;
  }

  return data.value > 0 || (data.children?.length ?? 0) > 0;
}

export type FlameGraphProps = Omit<ComponentProps<'div'>, 'onSelect'> & {
  data: FlameGraphNode | null;
  /** Key of the zoomed frame. Uncontrolled when omitted. */
  focusedKey?: string;
  onFocusedKeyChange?: (key: string | null, node: FlameGraphNode | null) => void;
  /** Key of the frame rendered as selected. */
  selectedKey?: string;
  onSelect?: (key: string, node: FlameGraphNode) => void;
  /** Row height in pixels. @default 20 */
  rowHeight?: number;
  /** Formats a value for labels and hover text. @default String */
  formatValue?: (value: number) => string;
  /** Case-insensitive substring matched against each frame's name and
   *  tooltip. Matching frames are outlined, the rest are washed out. */
  highlight?: string;
  /** Frames narrower than this percentage of the viewport are not rendered. @default 0.08 */
  minFrameWidth?: number;
  /** Rendered instead of the graph when `data` is null or has no value. */
  emptyState?: ReactNode;
};

/**
 * An interactive flame graph for hierarchical profiling data (call stacks,
 * module/bundle sizes, ...). Click a frame to zoom into its subtree, press
 * `Escape` to zoom back out. Purely CSS/percentage-based — no measurement or
 * canvas/SVG involved — so it stays responsive for free.
 */
function FlameGraphRoot({
  className,
  data,
  focusedKey: focusedKeyProp,
  onFocusedKeyChange,
  selectedKey,
  onSelect,
  rowHeight = DEFAULT_ROW_HEIGHT,
  formatValue = defaultFormatValue,
  highlight,
  minFrameWidth = DEFAULT_MIN_FRAME_WIDTH,
  emptyState,
  onKeyDown,
  ...props
}: FlameGraphProps) {
  const [uncontrolledFocusedKey, setUncontrolledFocusedKey] = useState<string | null>(null);
  const focusedKey = focusedKeyProp ?? uncontrolledFocusedKey ?? undefined;

  const { frames, depthCount } = useMemo(
    () => layoutFlameGraph(data, { focusedKey, minFrameWidth }),
    [data, focusedKey, minFrameWidth],
  );

  const rows = useMemo(() => {
    const grouped: FlameGraphFrame[][] = Array.from({ length: depthCount }, () => []);
    for (const frame of frames) {
      grouped[frame.depth]?.push(frame);
    }
    return grouped;
  }, [frames, depthCount]);

  const resetFocus = () => {
    setUncontrolledFocusedKey(null);
    onFocusedKeyChange?.(null, null);
  };

  const handleFrameClick = (frame: FlameGraphFrame) => {
    setUncontrolledFocusedKey(frame.key);
    onFocusedKeyChange?.(frame.key, frame.node);
    onSelect?.(frame.key, frame.node);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      resetFocus();
    }
    onKeyDown?.(event);
  };

  if (!hasRenderableData(data)) {
    return (
      <div data-slot="flame-graph" className={cn('flex flex-col', className)} {...props}>
        {emptyState ?? (
          <EmptyState
            title="No profiling data"
            description="Once frames are captured, the flame graph will appear here."
          />
        )}
      </div>
    );
  }

  return (
    <div
      data-slot="flame-graph"
      className={cn('overflow-auto', className)}
      onKeyDown={handleKeyDown}
      {...props}
    >
      <div
        style={{ height: depthCount * rowHeight }}
        className="relative w-full transition-[height] duration-150 ease-out motion-reduce:transition-none"
      >
        {rows.map((rowFrames, depth) => (
          <div key={depth} className="relative" style={{ height: rowHeight }}>
            {rowFrames.map((frame) => (
              <FlameGraphFrameButton
                key={frame.key}
                frame={frame}
                formatValue={formatValue}
                highlight={highlight}
                selected={frame.key === selectedKey}
                onClick={handleFrameClick}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

type FlameGraphFrameButtonProps = {
  frame: FlameGraphFrame;
  formatValue: (value: number) => string;
  highlight: string | undefined;
  selected: boolean;
  onClick: (frame: FlameGraphFrame) => void;
};

function FlameGraphFrameButton({
  frame,
  formatValue,
  highlight,
  selected,
  onClick,
}: FlameGraphFrameButtonProps) {
  const { node, left, width, heat } = frame;
  const bucket = getHeatBucket(heat);
  const formattedValue = formatValue(node.value);
  const matched = matchesHighlight(node, highlight);

  return (
    <button
      type="button"
      data-slot="flame-graph-frame"
      // A native tooltip, not the `Tooltip` component — a profile can have
      // thousands of frames, and mounting a base-ui popup root per frame
      // would be far too heavy.
      title={`${node.tooltip ?? node.name} — ${formattedValue}`}
      aria-label={`${node.name}: ${formattedValue}`}
      onClick={() => onClick(frame)}
      style={{ left: `${left}%`, width: `${width}%` }}
      className={cn(
        'absolute inset-y-0 overflow-hidden border-r border-background/50 px-1 text-left',
        // Zooming only changes a surviving frame's position and width, so
        // transitioning them animates the whole graph with no extra
        // dependency and nothing to tear down.
        'transition-[left,width] duration-150 ease-out motion-reduce:transition-none',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        matched ? heatBucketClassName[bucket] : heatBucketMutedClassName[bucket],
        // A match is outlined rather than merely left undimmed: a matching
        // frame with no self time sits in the palest bucket, so on its own
        // "not washed out" reads as less prominent than the frames around it.
        highlight && matched && 'ring-1 ring-primary ring-inset',
        selected && 'ring-2 ring-ring ring-inset',
      )}
    >
      {width > MIN_LABEL_WIDTH_PERCENT && (
        <span
          className={cn(
            'block truncate text-[11px] leading-none',
            highlight && matched && 'font-medium',
          )}
        >
          {node.name}
        </span>
      )}
    </button>
  );
}

const LEGEND_ITEMS: { bucket: FlameGraphHeatBucket; label: string }[] = [
  { bucket: 'heaviest', label: 'Heaviest (>70%)' },
  { bucket: 'heavy', label: 'Heavy (40-70%)' },
  { bucket: 'moderate', label: 'Moderate (20-40%)' },
  { bucket: 'light', label: 'Light (<20%)' },
  { bucket: 'none', label: 'No self time' },
];

export type FlameGraphLegendProps = ComponentProps<'div'>;

/** Legend for the heat buckets `FlameGraph` colors frames by. */
function FlameGraphLegend({ className, ...props }: FlameGraphLegendProps) {
  return (
    <div
      data-slot="flame-graph-legend"
      className={cn('flex flex-wrap items-center gap-3', className)}
      {...props}
    >
      {LEGEND_ITEMS.map(({ bucket, label }) => (
        <div key={bucket} className="flex items-center gap-1.5">
          <span className={cn('h-3 w-3 shrink-0 rounded-sm', heatBucketClassName[bucket])} />
          <Text variant="caption">{label}</Text>
        </div>
      ))}
    </div>
  );
}

/** An interactive, zoomable flame graph for hierarchical profiling data. */
export const FlameGraph = Object.assign(FlameGraphRoot, {
  Legend: FlameGraphLegend,
});
