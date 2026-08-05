import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { X } from 'lucide-react';
import type { RequestId } from '../../shared/client';
import type { ProcessedRequest } from '../state/model';
import {
  useNetworkActivityActions,
  useSelectedRequestId,
} from '../state/hooks';
import {
  formatTimelineOffset,
  getTimelineBarTopOffset,
  getTimelineModel,
  getTimelineTrackTop,
  isRequestActive,
  TIMELINE_LAYOUT,
} from '../utils/timelineModel';
import type {
  TimelineModel,
  TimelineRangeSelection,
  TimelineRow,
  TimelineTick,
} from '../utils/timelineModel';

const REQUEST_TIMELINE_COLORS = {
  error: 'bg-red-400',
  primary: 'bg-gray-400',
  active: 'bg-gray-500',
  httpTtfb: 'bg-gray-200',
} as const;

const getPrimaryBarClassName = (request: ProcessedRequest) => {
  if (request.status === 'failed' || request.status === 'error') {
    return REQUEST_TIMELINE_COLORS.error;
  }

  return REQUEST_TIMELINE_COLORS.primary;
};

const getStyle = (
  offsetPercent: number,
  widthPercent: number,
): CSSProperties => ({
  left: `${offsetPercent}%`,
  width: `${widthPercent}%`,
});

const GridLines = ({ ticks }: { ticks: TimelineTick[] }) => {
  return (
    <div className="pointer-events-none absolute inset-0">
      {ticks.map((tick) => (
        <div
          key={`${tick.label}-${tick.offsetPercent}`}
          className="absolute inset-y-0 border-l border-gray-800"
          style={{ left: `${tick.offsetPercent}%` }}
        />
      ))}
    </div>
  );
};

const getTickLabelStyle = (tick: TimelineTick): CSSProperties => {
  if (tick.offsetPercent === 0) {
    return {
      left: 4,
    };
  }

  if (tick.offsetPercent === 100) {
    return {
      right: 4,
    };
  }

  return {
    left: `${tick.offsetPercent}%`,
  };
};

const TimelineTrack = ({
  row,
  isSelected,
  onSelect,
  shouldSuppressSelect,
}: {
  row: TimelineRow;
  isSelected: boolean;
  onSelect: (requestId: RequestId) => void;
  shouldSuppressSelect: () => boolean;
}) => {
  const primaryBarClassName = row.isActive
    ? REQUEST_TIMELINE_COLORS.active
    : getPrimaryBarClassName(row.request);
  const isSplitHttpBar =
    row.request.type === 'http' &&
    row.ttfbPercent > 0 &&
    row.receivePercent > 0;
  const trackTop = getTimelineTrackTop(row.lane);
  const barTop = getTimelineBarTopOffset();
  const positionStyle = {
    ...getStyle(row.offsetPercent, row.widthPercent),
    top: trackTop,
  };
  const durationLabel = row.isActive
    ? `${formatTimelineOffset(row.duration)}+`
    : formatTimelineOffset(row.duration);
  const label = `${row.request.method} ${row.request.name} - ${durationLabel}`;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-timeline-track="true"
      className="absolute rounded-sm text-left transition-opacity hover:opacity-80"
      style={{
        ...positionStyle,
        height: TIMELINE_LAYOUT.laneHitTargetHeightPx,
      }}
      onClick={(event) => {
        if (shouldSuppressSelect()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        onSelect(row.request.id);
      }}
    >
      {isSplitHttpBar ? (
        <div
          className={`absolute flex w-full overflow-hidden rounded-sm ${
            isSelected
              ? 'ring-1 ring-blue-300 ring-offset-1 ring-offset-gray-950'
              : ''
          }`}
          style={{
            top: barTop,
            height: TIMELINE_LAYOUT.laneHeightPx,
          }}
        >
          <div
            className={`h-full ${REQUEST_TIMELINE_COLORS.httpTtfb}`}
            style={{ width: `${row.ttfbPercent}%` }}
          />
          <div
            className={`h-full ${REQUEST_TIMELINE_COLORS.primary}`}
            style={{ width: `${row.receivePercent}%` }}
          />
        </div>
      ) : (
        <div
          className={`absolute w-full rounded-sm ${primaryBarClassName} ${
            isSelected
              ? 'ring-1 ring-blue-300 ring-offset-1 ring-offset-gray-950'
              : ''
          }`}
          style={{
            top: barTop,
            height: TIMELINE_LAYOUT.laneHeightPx,
          }}
        />
      )}
    </button>
  );
};

type DraftSelection = {
  anchorPercent: number;
  currentPercent: number;
  startedOnTrack: boolean;
};

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);

const getPointerPercent = (
  event: PointerEvent<HTMLDivElement>,
  element: HTMLDivElement,
) => {
  const rect = element.getBoundingClientRect();

  if (rect.width === 0) {
    return 0;
  }

  return clampPercent(((event.clientX - rect.left) / rect.width) * 100);
};

const getSelectionStyle = (
  range: TimelineRangeSelection,
  timeline: TimelineModel,
): CSSProperties => {
  const startPercent = clampPercent(
    ((range.startTime - timeline.rangeStart) / timeline.rangeDuration) * 100,
  );
  const endPercent = clampPercent(
    ((range.endTime - timeline.rangeStart) / timeline.rangeDuration) * 100,
  );
  const left = Math.min(startPercent, endPercent);
  const width = Math.abs(endPercent - startPercent);

  return {
    left: `${left}%`,
    width: `${width}%`,
    top: TIMELINE_LAYOUT.rulerHeightPx,
  };
};

const getDraftSelectionStyle = (draft: DraftSelection): CSSProperties => {
  const left = Math.min(draft.anchorPercent, draft.currentPercent);
  const width = Math.abs(draft.currentPercent - draft.anchorPercent);

  return {
    left: `${left}%`,
    width: `${width}%`,
    top: TIMELINE_LAYOUT.rulerHeightPx,
  };
};

export type NetworkTimelineProps = {
  requests: ProcessedRequest[];
  selection: TimelineRangeSelection | null;
  filteredRequestCount: number;
  onSelectionChange: (selection: TimelineRangeSelection | null) => void;
};

export const NetworkTimeline = ({
  requests,
  selection,
  filteredRequestCount,
  onSelectionChange,
}: NetworkTimelineProps) => {
  const actions = useNetworkActivityActions();
  const selectedRequestId = useSelectedRequestId();
  const [now, setNow] = useState(() => Date.now());
  const [draftSelection, setDraftSelection] = useState<DraftSelection | null>(
    null,
  );
  const chartRef = useRef<HTMLDivElement | null>(null);
  const suppressTrackClickRef = useRef(false);

  const hasActiveRequests = requests.some(isRequestActive);

  useEffect(() => {
    if (!hasActiveRequests) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, TIMELINE_LAYOUT.liveRefreshMs);

    return () => window.clearInterval(interval);
  }, [hasActiveRequests]);

  const timeline = useMemo(() => {
    return getTimelineModel(requests, now);
  }, [requests, now]);

  const onRequestSelect = (requestId: RequestId) => {
    actions.setSelectedRequest(requestId);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || requests.length === 0) {
      return;
    }

    const chartElement = chartRef.current;

    if (!chartElement) {
      return;
    }

    const percent = getPointerPercent(event, chartElement);
    const target = event.target;
    const startedOnTrack =
      target instanceof Element &&
      target.closest('[data-timeline-track="true"]') !== null;

    setDraftSelection({
      anchorPercent: percent,
      currentPercent: percent,
      startedOnTrack,
    });
    chartElement.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draftSelection) {
      return;
    }

    const chartElement = chartRef.current;

    if (!chartElement) {
      return;
    }

    event.preventDefault();
    const percent = getPointerPercent(event, chartElement);

    setDraftSelection((current) =>
      current ? { ...current, currentPercent: percent } : current,
    );
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!draftSelection) {
      return;
    }

    const chartElement = chartRef.current;
    const currentPercent = chartElement
      ? getPointerPercent(event, chartElement)
      : draftSelection.currentPercent;
    const distance = Math.abs(currentPercent - draftSelection.anchorPercent);

    if (distance > 1) {
      const startOffset =
        (Math.min(draftSelection.anchorPercent, currentPercent) / 100) *
        timeline.rangeDuration;
      const endOffset =
        (Math.max(draftSelection.anchorPercent, currentPercent) / 100) *
        timeline.rangeDuration;

      onSelectionChange({
        startTime: timeline.rangeStart + startOffset,
        endTime: timeline.rangeStart + endOffset,
      });

      suppressTrackClickRef.current = true;
      window.setTimeout(() => {
        suppressTrackClickRef.current = false;
      }, 0);
    } else if (!draftSelection.startedOnTrack) {
      onSelectionChange(null);
    }

    setDraftSelection(null);

    if (chartElement?.hasPointerCapture(event.pointerId)) {
      chartElement.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="border-b border-gray-700 bg-gray-900 p-1.5">
      <div
        ref={chartRef}
        className="relative overflow-hidden border border-gray-800 bg-gray-950"
        style={{ height: timeline.chartHeight }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <GridLines ticks={timeline.ticks} />

        <div
          className="pointer-events-none absolute inset-x-0 border-b border-gray-800"
          style={{ top: TIMELINE_LAYOUT.rulerHeightPx }}
        />

        {timeline.ticks.map((tick) => (
          <div
            key={`${tick.label}-${tick.offsetPercent}`}
            className="absolute top-1 whitespace-nowrap tabular-nums text-xs text-gray-200"
            style={getTickLabelStyle(tick)}
          >
            {tick.label}
          </div>
        ))}

        {selection && (
          <div
            className="pointer-events-none absolute bottom-0 border-x border-blue-300/70 bg-blue-400/10"
            style={getSelectionStyle(selection, timeline)}
          />
        )}

        {draftSelection && (
          <div
            className="pointer-events-none absolute bottom-0 border-x border-blue-300/70 bg-blue-400/15"
            style={getDraftSelectionStyle(draftSelection)}
          />
        )}

        {timeline.rows.map((row) => (
          <TimelineTrack
            key={row.request.id}
            row={row}
            isSelected={selectedRequestId === row.request.id}
            onSelect={onRequestSelect}
            shouldSuppressSelect={() => suppressTrackClickRef.current}
          />
        ))}

        {selection && (
          <div className="absolute bottom-1 right-1 flex items-center gap-1 rounded border border-gray-700 bg-gray-900/95 px-1.5 py-0.5 text-xs text-gray-400">
            <span>{filteredRequestCount} in range</span>
            <button
              type="button"
              title="Clear timeline selection"
              aria-label="Clear timeline selection"
              className="rounded p-0.5 text-gray-400 hover:bg-gray-800 hover:text-gray-100"
              onClick={() => onSelectionChange(null)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {timeline.hiddenRequestCount > 0 && (
          <div className="absolute bottom-1 left-1 rounded border border-gray-700 bg-gray-900/95 px-1.5 py-0.5 text-xs text-gray-400">
            Showing latest {timeline.rows.length} of{' '}
            {timeline.totalRequestCount}
          </div>
        )}
      </div>
    </div>
  );
};
