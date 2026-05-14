import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
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
import type { TimelineRow, TimelineTick } from '../utils/timelineModel';

const REQUEST_TIMELINE_COLORS = {
  error: 'bg-red-400',
  http: 'bg-sky-400',
  websocket: 'bg-emerald-400',
  sse: 'bg-amber-400',
  httpTtfb: 'bg-lime-400',
} as const;

const LEGEND_ITEMS = [
  { label: 'HTTP', className: REQUEST_TIMELINE_COLORS.http },
  { label: 'WebSocket', className: REQUEST_TIMELINE_COLORS.websocket },
  { label: 'SSE', className: REQUEST_TIMELINE_COLORS.sse },
  { label: 'TTFB', className: REQUEST_TIMELINE_COLORS.httpTtfb },
  { label: 'Error', className: REQUEST_TIMELINE_COLORS.error },
];

const getPrimaryBarClassName = (request: ProcessedRequest) => {
  if (request.status === 'failed' || request.status === 'error') {
    return REQUEST_TIMELINE_COLORS.error;
  }

  switch (request.type) {
    case 'websocket':
      return REQUEST_TIMELINE_COLORS.websocket;
    case 'sse':
      return REQUEST_TIMELINE_COLORS.sse;
    case 'http':
      return REQUEST_TIMELINE_COLORS.http;
  }
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
          className="absolute inset-y-0 border-l border-gray-700/70"
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
}: {
  row: TimelineRow;
  isSelected: boolean;
  onSelect: (requestId: RequestId) => void;
}) => {
  const primaryBarClassName = getPrimaryBarClassName(row.request);
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
      className={`absolute rounded-sm text-left transition-opacity hover:opacity-80 ${
        row.isActive ? 'animate-pulse' : ''
      } ${
        isSelected ? 'outline outline-1 outline-offset-1 outline-blue-300' : ''
      }`}
      style={{
        ...positionStyle,
        height: TIMELINE_LAYOUT.laneHitTargetHeightPx,
      }}
      onClick={() => onSelect(row.request.id)}
    >
      {isSplitHttpBar ? (
        <div
          className="absolute flex w-full overflow-hidden rounded-sm"
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
            className={`h-full ${REQUEST_TIMELINE_COLORS.http}`}
            style={{ width: `${row.receivePercent}%` }}
          />
        </div>
      ) : (
        <div
          className={`absolute w-full rounded-sm ${primaryBarClassName}`}
          style={{
            top: barTop,
            height: TIMELINE_LAYOUT.laneHeightPx,
          }}
        />
      )}
    </button>
  );
};

const TimelineLegend = () => {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 text-xs text-gray-400">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-sm ${item.className}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export type NetworkTimelineProps = {
  requests: ProcessedRequest[];
};

export const NetworkTimeline = ({ requests }: NetworkTimelineProps) => {
  const actions = useNetworkActivityActions();
  const selectedRequestId = useSelectedRequestId();
  const [now, setNow] = useState(() => Date.now());

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

  return (
    <div className="border-b border-gray-700 bg-gray-900 p-2">
      <TimelineLegend />
      {requests.length === 0 ? (
        <div className="flex h-24 items-center justify-center border border-dashed border-gray-700 bg-gray-950 text-sm text-gray-500">
          No requests match the current filters
        </div>
      ) : (
        <div
          className="relative overflow-hidden border border-gray-800 bg-gray-950"
          style={{ height: timeline.chartHeight }}
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

          {timeline.rows.map((row) => (
            <TimelineTrack
              key={row.request.id}
              row={row}
              isSelected={selectedRequestId === row.request.id}
              onSelect={onRequestSelect}
            />
          ))}

          {timeline.hiddenRequestCount > 0 && (
            <div className="absolute bottom-2 right-2 rounded border border-gray-700 bg-gray-900/95 px-2 py-1 text-xs text-gray-400">
              Showing latest {timeline.rows.length} of{' '}
              {timeline.totalRequestCount}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
