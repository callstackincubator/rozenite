import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { RequestId } from '../../shared/client';
import type { ProcessedRequest } from '../state/model';
import {
  useNetworkActivityActions,
  useOverrides,
  useProcessedRequests,
  useSelectedRequestId,
} from '../state/hooks';
import { matchesRequestFilter } from '../utils/requestFilters';
import type { FilterState } from './FilterBar';

const MIN_VISIBLE_BAR_PERCENT = 0.65;
const MIN_RANGE_MS = 1000;
const LIVE_REFRESH_MS = 1000;
const CHART_LANE_COUNT = 8;
const CHART_LANE_HEIGHT = 3;
const CHART_LANE_GAP = 4;
const CHART_RULER_HEIGHT = 28;
const CHART_LANE_TOP = 44;
const TICK_TARGET_COUNT = 7;
const NICE_TICK_STEPS = [
  50, 100, 250, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000,
  300000,
];

type TimelineRequest = {
  request: ProcessedRequest;
  startTime: number;
  endTime: number;
  offsetPercent: number;
  widthPercent: number;
  duration: number;
  ttfbPercent: number;
  receivePercent: number;
  isActive: boolean;
  lane: number;
};

type TimelineTick = {
  label: string;
  offsetPercent: number;
};

const activeStatuses = new Set(['pending', 'loading', 'connecting', 'open']);

const isActiveRequest = (request: ProcessedRequest) => {
  return activeStatuses.has(request.status);
};

const getPrimaryBarClassName = (request: ProcessedRequest) => {
  if (request.status === 'failed' || request.status === 'error') {
    return 'bg-red-400';
  }

  switch (request.type) {
    case 'websocket':
      return 'bg-emerald-400';
    case 'sse':
      return 'bg-amber-400';
    case 'http':
      return 'bg-sky-400';
  }
};

const formatOffset = (milliseconds: number) => {
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)} ms`;
  }

  if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(milliseconds < 10000 ? 1 : 0)} s`;
  }

  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.round((milliseconds % 60000) / 1000);
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

const getRequestEndTime = (request: ProcessedRequest, now: number) => {
  if (typeof request.duration === 'number') {
    return request.timestamp + Math.max(request.duration, 0);
  }

  if (isActiveRequest(request)) {
    return Math.max(now, request.timestamp);
  }

  return request.timestamp;
};

const getTimelineTicks = (rangeDuration: number): TimelineTick[] => {
  const targetStep = rangeDuration / TICK_TARGET_COUNT;
  const step =
    NICE_TICK_STEPS.find((candidate) => candidate >= targetStep) ??
    NICE_TICK_STEPS[NICE_TICK_STEPS.length - 1];
  const ticks: TimelineTick[] = [];

  for (let value = 0; value <= rangeDuration; value += step) {
    ticks.push({
      label: formatOffset(value),
      offsetPercent: (value / rangeDuration) * 100,
    });
  }

  if (
    ticks.length === 0 ||
    ticks[ticks.length - 1].offsetPercent < 100 - Number.EPSILON
  ) {
    ticks.push({
      label: formatOffset(rangeDuration),
      offsetPercent: 100,
    });
  }

  return ticks;
};

const getTimelineRequests = (requests: ProcessedRequest[], now: number) => {
  if (requests.length === 0) {
    return {
      rows: [],
      rangeStart: 0,
      rangeDuration: MIN_RANGE_MS,
    };
  }

  const bounds = requests.reduce(
    (result, request) => {
      const endTime = getRequestEndTime(request, now);

      return {
        start: Math.min(result.start, request.timestamp),
        end: Math.max(result.end, endTime),
      };
    },
    {
      start: Number.POSITIVE_INFINITY,
      end: Number.NEGATIVE_INFINITY,
    },
  );

  const rawRangeDuration = Math.max(bounds.end - bounds.start, MIN_RANGE_MS);
  const rangePadding = Math.max(rawRangeDuration * 0.025, 25);
  const rangeStart = bounds.start - rangePadding;
  const rangeDuration = rawRangeDuration + rangePadding * 2;
  const laneEndTimes = Array.from({ length: CHART_LANE_COUNT }, () => 0);

  const rows = [...requests]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((request): TimelineRequest => {
      const startTime = request.timestamp;
      const endTime = getRequestEndTime(request, now);
      const duration = Math.max(endTime - startTime, 0);
      const rawOffsetPercent = ((startTime - rangeStart) / rangeDuration) * 100;
      const offsetPercent = Math.min(Math.max(rawOffsetPercent, 0), 99.35);
      const rawWidthPercent = (duration / rangeDuration) * 100;
      const widthPercent = Math.min(
        Math.max(rawWidthPercent, MIN_VISIBLE_BAR_PERCENT),
        100 - offsetPercent,
      );
      const ttfb = Math.min(Math.max(request.ttfb ?? 0, 0), duration);
      const ttfbPercent = duration === 0 ? 0 : (ttfb / duration) * 100;
      const receivePercent = Math.max(100 - ttfbPercent, 0);
      const availableLane = laneEndTimes.findIndex(
        (laneEndTime) => laneEndTime <= startTime,
      );
      const lane = availableLane === -1 ? 0 : availableLane;
      laneEndTimes[lane] = endTime;

      return {
        request,
        startTime,
        endTime,
        offsetPercent,
        widthPercent,
        duration,
        ttfbPercent,
        receivePercent,
        isActive: isActiveRequest(request),
        lane,
      };
    });

  return {
    rows,
    rangeStart,
    rangeDuration,
  };
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

const TimelineTrack = ({
  row,
  isSelected,
  onSelect,
}: {
  row: TimelineRequest;
  isSelected: boolean;
  onSelect: (requestId: RequestId) => void;
}) => {
  const primaryBarClassName = getPrimaryBarClassName(row.request);
  const isSplitHttpBar =
    row.request.type === 'http' &&
    row.ttfbPercent > 0 &&
    row.receivePercent > 0;
  const top = CHART_LANE_TOP + row.lane * (CHART_LANE_HEIGHT + CHART_LANE_GAP);
  const positionStyle = {
    ...getStyle(row.offsetPercent, row.widthPercent),
    top,
  };
  const durationLabel = row.isActive
    ? `${formatOffset(row.duration)}+`
    : formatOffset(row.duration);

  return (
    <button
      type="button"
      title={`${row.request.method} ${row.request.name} - ${durationLabel}`}
      className={`absolute h-[3px] overflow-hidden rounded-sm text-left transition-opacity hover:opacity-80 ${
        row.isActive ? 'animate-pulse' : ''
      } ${
        isSelected ? 'outline outline-1 outline-offset-1 outline-blue-300' : ''
      }`}
      style={positionStyle}
      onClick={() => onSelect(row.request.id)}
    >
      {isSplitHttpBar ? (
        <div className="flex h-full w-full">
          <div
            className="h-full bg-lime-400"
            style={{ width: `${row.ttfbPercent}%` }}
          />
          <div
            className="h-full bg-sky-400"
            style={{ width: `${row.receivePercent}%` }}
          />
        </div>
      ) : (
        <div className={`h-full w-full ${primaryBarClassName}`} />
      )}
    </button>
  );
};

export type NetworkTimelineProps = {
  filter: FilterState;
};

export const NetworkTimeline = ({ filter }: NetworkTimelineProps) => {
  const actions = useNetworkActivityActions();
  const processedRequests = useProcessedRequests();
  const selectedRequestId = useSelectedRequestId();
  const overrides = useOverrides();
  const [now, setNow] = useState(() => Date.now());

  const filteredRequests = useMemo(() => {
    return processedRequests.filter((request) =>
      matchesRequestFilter(request, filter, {
        hasOverride: overrides.has(request.name),
      }),
    );
  }, [processedRequests, filter, overrides]);

  const hasActiveRequests = filteredRequests.some(isActiveRequest);

  useEffect(() => {
    if (!hasActiveRequests) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, LIVE_REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [hasActiveRequests]);

  const timeline = useMemo(() => {
    return getTimelineRequests(filteredRequests, now);
  }, [filteredRequests, now]);

  const ticks = useMemo(() => {
    return getTimelineTicks(timeline.rangeDuration);
  }, [timeline.rangeDuration]);

  const onRequestSelect = (requestId: RequestId) => {
    actions.setSelectedRequest(requestId);
  };

  return (
    <div className="border-b border-gray-700 bg-gray-900 p-2">
      {filteredRequests.length === 0 ? (
        <div className="flex h-24 items-center justify-center border border-dashed border-gray-700 bg-gray-950 text-sm text-gray-500">
          No requests match the current filters
        </div>
      ) : (
        <div className="relative h-32 overflow-hidden border border-gray-800 bg-gray-950">
          <GridLines ticks={ticks} />

          <div
            className="pointer-events-none absolute inset-x-0 border-b border-gray-800"
            style={{ top: CHART_RULER_HEIGHT }}
          />

          {ticks.map((tick) => (
            <div
              key={tick.label}
              className="absolute top-1 whitespace-nowrap pl-1 tabular-nums text-xs text-gray-200"
              style={{ left: `${tick.offsetPercent}%` }}
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
        </div>
      )}
    </div>
  );
};
