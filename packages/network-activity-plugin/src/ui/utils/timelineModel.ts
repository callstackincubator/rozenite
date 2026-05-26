import type { ProcessedRequest } from '../state/model';

export const TIMELINE_LAYOUT = {
  minVisibleBarPercent: 0.65,
  minRangeMs: 1000,
  liveRefreshMs: 1000,
  maxRenderedRequests: 1000,
  laneCount: 8,
  laneHeightPx: 2,
  laneGapPx: 6,
  laneHitTargetHeightPx: 8,
  rulerHeightPx: 22,
  laneTopPx: 32,
  laneBottomPaddingPx: 18,
  tickTargetCount: 7,
  minTickLabelGapPercent: 6,
  rangePaddingRatio: 0.025,
  minRangePaddingMs: 25,
  streamingRequestMaxDurationMs: 5000,
} as const;

const NICE_TICK_FACTORS = [1, 2, 2.5, 5, 10] as const;

type TimelineLayout = {
  [Key in keyof typeof TIMELINE_LAYOUT]: number;
};

export type TimelineTick = {
  label: string;
  offsetPercent: number;
};

export type TimelineRangeSelection = {
  startTime: number;
  endTime: number;
};

export type TimelineRow = {
  request: ProcessedRequest;
  offsetPercent: number;
  widthPercent: number;
  duration: number;
  ttfbPercent: number;
  receivePercent: number;
  isActive: boolean;
  lane: number;
  isOverflowingLane: boolean;
};

export type TimelineModel = {
  rows: TimelineRow[];
  ticks: TimelineTick[];
  rangeStart: number;
  rangeDuration: number;
  chartHeight: number;
  totalRequestCount: number;
  hiddenRequestCount: number;
};

const ACTIVE_HTTP_STATUSES = new Set<ProcessedRequest['status']>([
  'pending',
  'loading',
]);
const ACTIVE_WEBSOCKET_STATUSES = new Set<ProcessedRequest['status']>([
  'connecting',
  'open',
  'closing',
]);
const ACTIVE_SSE_STATUSES = new Set<ProcessedRequest['status']>([
  'connecting',
  'open',
]);

const clamp = (value: number, minimum: number, maximum: number) => {
  return Math.min(Math.max(value, minimum), maximum);
};

export const getTimelineChartHeight = (
  layout: TimelineLayout = TIMELINE_LAYOUT,
) => {
  return (
    layout.laneTopPx +
    layout.laneCount * layout.laneHeightPx +
    (layout.laneCount - 1) * layout.laneGapPx +
    layout.laneBottomPaddingPx
  );
};

export const getTimelineLaneTop = (
  lane: number,
  layout: TimelineLayout = TIMELINE_LAYOUT,
) => {
  return lane * (layout.laneHeightPx + layout.laneGapPx) + layout.laneTopPx;
};

export const getTimelineTrackTop = (
  lane: number,
  layout: TimelineLayout = TIMELINE_LAYOUT,
) => {
  const visualBarTop = getTimelineLaneTop(lane, layout);
  return (
    visualBarTop - (layout.laneHitTargetHeightPx - layout.laneHeightPx) / 2
  );
};

export const getTimelineBarTopOffset = (
  layout: TimelineLayout = TIMELINE_LAYOUT,
) => {
  return (layout.laneHitTargetHeightPx - layout.laneHeightPx) / 2;
};

export const isRequestActive = (request: ProcessedRequest) => {
  switch (request.type) {
    case 'http':
      return ACTIVE_HTTP_STATUSES.has(request.status);
    case 'websocket':
      return ACTIVE_WEBSOCKET_STATUSES.has(request.status);
    case 'sse':
      return ACTIVE_SSE_STATUSES.has(request.status);
  }
};

export const formatTimelineOffset = (milliseconds: number) => {
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)} ms`;
  }

  if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(milliseconds < 10000 ? 1 : 0)} s`;
  }

  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

export const getRequestEndTime = (request: ProcessedRequest, now: number) => {
  if (typeof request.duration === 'number') {
    return request.timestamp + Math.max(request.duration, 0);
  }

  if (isRequestActive(request)) {
    return Math.max(now, request.timestamp);
  }

  return request.timestamp;
};

export const getTimelineRequestEndTime = (
  request: ProcessedRequest,
  now: number,
  layout: TimelineLayout = TIMELINE_LAYOUT,
) => {
  const endTime = getRequestEndTime(request, now);

  if (request.type !== 'websocket' && request.type !== 'sse') {
    return endTime;
  }

  return Math.min(
    endTime,
    request.timestamp + layout.streamingRequestMaxDurationMs,
  );
};

export const requestOverlapsTimelineRange = (
  request: ProcessedRequest,
  range: TimelineRangeSelection,
  now: number,
  layout: TimelineLayout = TIMELINE_LAYOUT,
) => {
  const rangeStart = Math.min(range.startTime, range.endTime);
  const rangeEnd = Math.max(range.startTime, range.endTime);
  const requestStart = request.timestamp;
  const requestEnd = getTimelineRequestEndTime(request, now, layout);

  return requestStart <= rangeEnd && requestEnd >= rangeStart;
};

const getNiceTickStep = (rangeDuration: number, targetTickCount: number) => {
  const targetStep = rangeDuration / targetTickCount;
  const exponent = Math.floor(Math.log10(targetStep));
  const magnitude = 10 ** exponent;
  const normalizedStep = targetStep / magnitude;
  const factor =
    NICE_TICK_FACTORS.find((candidate) => candidate >= normalizedStep) ??
    NICE_TICK_FACTORS[NICE_TICK_FACTORS.length - 1];

  return factor * magnitude;
};

export const getTimelineTicks = (
  rangeDuration: number,
  layout: TimelineLayout = TIMELINE_LAYOUT,
): TimelineTick[] => {
  const step = getNiceTickStep(rangeDuration, layout.tickTargetCount);
  const ticks: TimelineTick[] = [];

  for (let value = 0; value <= rangeDuration; value += step) {
    ticks.push({
      label: formatTimelineOffset(value),
      offsetPercent: (value / rangeDuration) * 100,
    });
  }

  if (
    ticks.length === 0 ||
    ticks[ticks.length - 1].offsetPercent < 100 - Number.EPSILON
  ) {
    const finalTick = {
      label: formatTimelineOffset(rangeDuration),
      offsetPercent: 100,
    };
    const previousTick = ticks[ticks.length - 1];

    if (
      !previousTick ||
      (finalTick.label !== previousTick.label &&
        finalTick.offsetPercent - previousTick.offsetPercent >=
          layout.minTickLabelGapPercent)
    ) {
      ticks.push(finalTick);
    }
  }

  return ticks;
};

const getTimelineBounds = (
  requests: ProcessedRequest[],
  now: number,
  layout: TimelineLayout,
) => {
  return requests.reduce(
    (result, request) => {
      const endTime = getTimelineRequestEndTime(request, now, layout);

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
};

const getEarliestLaneIndex = (laneEndTimes: number[]) => {
  return laneEndTimes.reduce((earliestIndex, laneEndTime, index) => {
    return laneEndTime < laneEndTimes[earliestIndex] ? index : earliestIndex;
  }, 0);
};

const getRenderableRequests = (
  requests: ProcessedRequest[],
  layout: TimelineLayout,
) => {
  if (requests.length <= layout.maxRenderedRequests) {
    return requests;
  }

  return [...requests]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, layout.maxRenderedRequests);
};

export const getTimelineModel = (
  requests: ProcessedRequest[],
  now: number,
  layout: TimelineLayout = TIMELINE_LAYOUT,
): TimelineModel => {
  const renderableRequests = getRenderableRequests(requests, layout);
  const hiddenRequestCount = requests.length - renderableRequests.length;

  if (renderableRequests.length === 0) {
    return {
      rows: [],
      ticks: getTimelineTicks(layout.minRangeMs, layout),
      rangeStart: 0,
      rangeDuration: layout.minRangeMs,
      chartHeight: getTimelineChartHeight(layout),
      totalRequestCount: requests.length,
      hiddenRequestCount,
    };
  }

  const bounds = getTimelineBounds(renderableRequests, now, layout);
  const rawRangeDuration = Math.max(
    bounds.end - bounds.start,
    layout.minRangeMs,
  );
  const rangePadding = Math.max(
    rawRangeDuration * layout.rangePaddingRatio,
    layout.minRangePaddingMs,
  );
  const rangeStart = bounds.start - rangePadding;
  const rangeDuration = rawRangeDuration + rangePadding * 2;
  const laneEndTimes = Array.from({ length: layout.laneCount }, () => 0);

  const rows = [...renderableRequests]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((request): TimelineRow => {
      const startTime = request.timestamp;
      const endTime = getTimelineRequestEndTime(request, now, layout);
      const duration = Math.max(endTime - startTime, 0);
      const offsetPercent = clamp(
        ((startTime - rangeStart) / rangeDuration) * 100,
        0,
        100 - layout.minVisibleBarPercent,
      );
      const widthPercent = Math.min(
        Math.max((duration / rangeDuration) * 100, layout.minVisibleBarPercent),
        100 - offsetPercent,
      );
      const ttfb = clamp(request.ttfb ?? 0, 0, duration);
      const ttfbPercent = duration === 0 ? 0 : (ttfb / duration) * 100;
      const receivePercent = Math.max(100 - ttfbPercent, 0);
      const availableLane = laneEndTimes.findIndex(
        (laneEndTime) => laneEndTime <= startTime,
      );
      const isOverflowingLane = availableLane === -1;
      const lane = isOverflowingLane
        ? getEarliestLaneIndex(laneEndTimes)
        : availableLane;
      laneEndTimes[lane] = Math.max(laneEndTimes[lane], endTime);

      return {
        request,
        offsetPercent,
        widthPercent,
        duration,
        ttfbPercent,
        receivePercent,
        isActive: isRequestActive(request),
        lane,
        isOverflowingLane,
      };
    });

  return {
    rows,
    ticks: getTimelineTicks(rangeDuration, layout),
    rangeStart,
    rangeDuration,
    chartHeight: getTimelineChartHeight(layout),
    totalRequestCount: requests.length,
    hiddenRequestCount,
  };
};
