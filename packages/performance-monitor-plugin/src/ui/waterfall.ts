import type {
  SerializedPerformanceEntry,
  SerializedPerformanceMetric,
  SerializedPerformanceResource,
} from '../shared/types';
import { formatBytes, formatDuration } from './utils';

export type WaterfallPhaseSegment = {
  label: string;
  startPercent: number;
  widthPercent: number;
  className: string;
};

export type WaterfallRow = {
  id: string;
  entry: SerializedPerformanceEntry;
  index: number;
  typeLabel: string;
  startOffset: number;
  visualStartOffset: number;
  duration: number;
  offsetPercent: number;
  widthPercent: number;
  valueLabel: string | null;
  phases: WaterfallPhaseSegment[];
};

export type WaterfallTick = {
  label: string;
  offsetPercent: number;
  title: string;
  elapsedTime: number;
  visualTime: number;
};

export type WaterfallGap = {
  id: string;
  label: string;
  startOffset: number;
  duration: number;
  offsetPercent: number;
  widthPercent: number;
};

export type WaterfallModel = {
  rows: WaterfallRow[];
  ticks: WaterfallTick[];
  gaps: WaterfallGap[];
  startTime: number;
  duration: number;
  timelineDuration: number;
  hasCompressedGaps: boolean;
};

const MIN_TIMELINE_DURATION = 1;
const MIN_TICK_SPACING_PERCENT = 6;

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
const clampRatio = (value: number) => Math.min(1, Math.max(0, value));

const isFiniteNumber = (value: number) => Number.isFinite(value);

const median = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
};

export const formatTimelineTime = (time: number) => {
  return `${Math.round(time).toLocaleString('en-US')} ms`;
};

const getNiceTickStep = (duration: number) => {
  const targetTicks = 5;
  const roughStep = Math.max(1, duration / targetTicks);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;

  if (normalized <= 1) {
    return magnitude;
  }

  if (normalized <= 2) {
    return 2 * magnitude;
  }

  if (normalized <= 5) {
    return 5 * magnitude;
  }

  return 10 * magnitude;
};

export const getEntryTypeLabel = (entry: SerializedPerformanceEntry) => {
  switch (entry.entryType) {
    case 'measure':
      return 'Measure';
    case 'mark':
      return 'Mark';
    case 'metric':
      return 'Metric';
    case 'react-native-mark':
      return 'React Native';
    case 'resource':
      return entry.initiatorType ?? 'Resource';
  }
};

export const getEntryValueLabel = (entry: SerializedPerformanceEntry) => {
  if (entry.entryType === 'resource') {
    return formatBytes(entry.transferSize);
  }

  if (entry.entryType === 'metric') {
    return String((entry as SerializedPerformanceMetric).value);
  }

  return null;
};

export const getEntryKey = (
  entry: SerializedPerformanceEntry,
  index?: number,
) => {
  const suffix = index === undefined ? '' : `:${index}`;
  return (
    [
      entry.entryType,
      entry.name,
      entry.startTime,
      entry.duration,
      entry.entryType === 'metric' ? entry.value : '',
      entry.entryType === 'resource' ? entry.responseEnd : '',
    ].join(':') + suffix
  );
};

export const isSamePerformanceEntry = (
  left: SerializedPerformanceEntry | null,
  right: SerializedPerformanceEntry | null,
) => {
  if (!left || !right) {
    return false;
  }

  return getEntryKey(left) === getEntryKey(right);
};

const createPhaseSegment = (
  label: string,
  start: number,
  end: number,
  baseline: number,
  duration: number,
  className: string,
): WaterfallPhaseSegment | null => {
  if (
    !isFiniteNumber(start) ||
    !isFiniteNumber(end) ||
    end <= start ||
    end <= baseline ||
    duration <= 0
  ) {
    return null;
  }

  const startPercent = clampPercent(((start - baseline) / duration) * 100);
  const endPercent = clampPercent(((end - baseline) / duration) * 100);
  const widthPercent = Math.max(0, endPercent - startPercent);

  if (widthPercent === 0) {
    return null;
  }

  return {
    label,
    startPercent,
    widthPercent,
    className,
  };
};

const getPositiveTimingValue = (value: number | undefined) => {
  if (value === undefined || !isFiniteNumber(value) || value <= 0) {
    return null;
  }

  return value;
};

const getResourceTimingBaseline = (resource: SerializedPerformanceResource) => {
  const inferredStart =
    resource.duration > 0 && resource.responseEnd > 0
      ? resource.responseEnd - resource.duration
      : null;
  const candidates = [
    inferredStart,
    getPositiveTimingValue(resource.workerStart),
    getPositiveTimingValue(resource.redirectStart),
    getPositiveTimingValue(resource.fetchStart),
    getPositiveTimingValue(resource.domainLookupStart),
    getPositiveTimingValue(resource.connectStart),
    getPositiveTimingValue(resource.requestStart),
    getPositiveTimingValue(resource.responseStart),
  ].filter(
    (value): value is number =>
      value !== null && isFiniteNumber(value) && value >= 0,
  );

  if (candidates.length > 0) {
    return Math.min(...candidates);
  }

  return 0;
};

const getResourceDuration = (resource: SerializedPerformanceResource) => {
  if (resource.duration > 0) {
    return resource.duration;
  }

  const baseline = getResourceTimingBaseline(resource);

  return Math.max(0, resource.responseEnd - baseline);
};

export const getResourcePhaseSegments = (
  resource: SerializedPerformanceResource,
): WaterfallPhaseSegment[] => {
  const baseline = getResourceTimingBaseline(resource);
  const duration = getResourceDuration(resource);
  const workerStart = getPositiveTimingValue(resource.workerStart);
  const secureConnectionStart = getPositiveTimingValue(
    resource.secureConnectionStart,
  );
  const connectPhaseEnd =
    secureConnectionStart !== null &&
    secureConnectionStart > resource.connectStart &&
    secureConnectionStart < resource.connectEnd
      ? secureConnectionStart
      : resource.connectEnd;

  const segments = [
    workerStart === null
      ? null
      : createPhaseSegment(
          'Worker',
          workerStart,
          resource.fetchStart,
          baseline,
          duration,
          'waterfall-phase-worker',
        ),
    createPhaseSegment(
      'Redirect',
      resource.redirectStart,
      resource.redirectEnd,
      baseline,
      duration,
      'waterfall-phase-redirect',
    ),
    createPhaseSegment(
      'DNS',
      resource.domainLookupStart,
      resource.domainLookupEnd,
      baseline,
      duration,
      'waterfall-phase-dns',
    ),
    createPhaseSegment(
      'Connect',
      resource.connectStart,
      connectPhaseEnd,
      baseline,
      duration,
      'waterfall-phase-connect',
    ),
    secureConnectionStart === null
      ? null
      : createPhaseSegment(
          'TLS',
          secureConnectionStart,
          resource.connectEnd,
          baseline,
          duration,
          'waterfall-phase-tls',
        ),
    createPhaseSegment(
      'Request / waiting',
      resource.requestStart,
      resource.responseStart,
      baseline,
      duration,
      'waterfall-phase-request',
    ),
    createPhaseSegment(
      'Response',
      resource.responseStart,
      resource.responseEnd,
      baseline,
      duration,
      'waterfall-phase-response',
    ),
  ];

  return segments.filter((segment): segment is WaterfallPhaseSegment =>
    Boolean(segment),
  );
};

const getEntryEndTime = (entry: SerializedPerformanceEntry) => {
  if (entry.entryType === 'resource') {
    return entry.startTime + getResourceDuration(entry);
  }

  return entry.startTime + Math.max(0, entry.duration);
};

type WaterfallCluster = {
  start: number;
  end: number;
  visualStart: number;
  visualDuration: number;
};

type WaterfallScale = {
  clusters: WaterfallCluster[];
  gaps: Array<{
    start: number;
    end: number;
    visualStart: number;
    visualDuration: number;
  }>;
  visualDuration: number;
  gapThreshold: number;
};

const createScale = (
  sortedEntries: SerializedPerformanceEntry[],
): WaterfallScale => {
  const positiveDurations = sortedEntries
    .map((entry) => getEntryEndTime(entry) - entry.startTime)
    .filter((duration) => duration > 0);
  const typicalDuration = median(positiveDurations);
  const gapThreshold = Math.max(1000, typicalDuration * 8);
  const compressedGapDuration = Math.max(250, Math.min(1500, gapThreshold / 2));
  const clusters: Array<
    Omit<WaterfallCluster, 'visualStart' | 'visualDuration'>
  > = [];

  for (const entry of sortedEntries) {
    const entryStart = entry.startTime;
    const entryEnd = getEntryEndTime(entry);
    const previousCluster = clusters.at(-1);

    if (!previousCluster) {
      clusters.push({ start: entryStart, end: entryEnd });
      continue;
    }

    const gap = entryStart - previousCluster.end;

    if (gap > gapThreshold) {
      clusters.push({ start: entryStart, end: entryEnd });
      continue;
    }

    previousCluster.end = Math.max(previousCluster.end, entryEnd);
  }

  const visualClusters: WaterfallCluster[] = [];
  const gaps: WaterfallScale['gaps'] = [];
  let visualCursor = 0;

  clusters.forEach((cluster, index) => {
    const visualDuration = Math.max(
      MIN_TIMELINE_DURATION,
      cluster.end - cluster.start,
    );

    visualClusters.push({
      ...cluster,
      visualStart: visualCursor,
      visualDuration,
    });

    visualCursor += visualDuration;

    const nextCluster = clusters[index + 1];
    if (nextCluster) {
      gaps.push({
        start: cluster.end,
        end: nextCluster.start,
        visualStart: visualCursor,
        visualDuration: compressedGapDuration,
      });
      visualCursor += compressedGapDuration;
    }
  });

  return {
    clusters: visualClusters,
    gaps,
    visualDuration: Math.max(MIN_TIMELINE_DURATION, visualCursor),
    gapThreshold,
  };
};

const getVisualTime = (time: number, scale: WaterfallScale) => {
  const firstCluster = scale.clusters[0];

  if (!firstCluster) {
    return 0;
  }

  for (const cluster of scale.clusters) {
    if (time <= cluster.end) {
      return (
        cluster.visualStart +
        clampRatio((time - cluster.start) / cluster.visualDuration) *
          cluster.visualDuration
      );
    }

    if (time < cluster.start) {
      return cluster.visualStart;
    }
  }

  const lastCluster = scale.clusters[scale.clusters.length - 1];
  return lastCluster.visualStart + lastCluster.visualDuration;
};

const createTicks = (scale: WaterfallScale): WaterfallTick[] => {
  const ticks: WaterfallTick[] = [];
  const seenOffsets = new Set<number>();

  const addTick = (visualTime: number) => {
    const offsetPercent = clampPercent(
      (visualTime / scale.visualDuration) * 100,
    );
    const roundedOffset = Math.round(visualTime);
    const lastTick = ticks.at(-1);

    if (seenOffsets.has(roundedOffset)) {
      return;
    }

    if (
      lastTick &&
      offsetPercent - lastTick.offsetPercent < MIN_TICK_SPACING_PERCENT
    ) {
      return;
    }

    seenOffsets.add(roundedOffset);
    ticks.push({
      label: formatTimelineTime(visualTime),
      offsetPercent,
      title: `${formatTimelineTime(visualTime)} on the normalized timeline`,
      elapsedTime: visualTime,
      visualTime,
    });
  };

  for (const cluster of scale.clusters) {
    const step = getNiceTickStep(cluster.end - cluster.start);
    const tickCount = Math.max(
      1,
      Math.floor((cluster.end - cluster.start) / step),
    );

    for (let index = 0; index <= tickCount; index += 1) {
      const localTime = Math.min(index * step, cluster.end - cluster.start);
      const visualTime = cluster.visualStart + localTime;

      addTick(visualTime);
    }
  }

  return ticks;
};

export const buildWaterfallModel = (
  entries: SerializedPerformanceEntry[],
): WaterfallModel => {
  const sortedEntries = entries
    .filter((entry) => isFiniteNumber(entry.startTime))
    .slice()
    .sort((left, right) => {
      if (left.startTime !== right.startTime) {
        return left.startTime - right.startTime;
      }

      return getEntryEndTime(right) - getEntryEndTime(left);
    });

  if (sortedEntries.length === 0) {
    return {
      rows: [],
      ticks: [],
      gaps: [],
      startTime: 0,
      duration: MIN_TIMELINE_DURATION,
      timelineDuration: MIN_TIMELINE_DURATION,
      hasCompressedGaps: false,
    };
  }

  const startTime = sortedEntries[0].startTime;
  const endTime = Math.max(...sortedEntries.map(getEntryEndTime));
  const duration = Math.max(MIN_TIMELINE_DURATION, endTime - startTime);
  const scale = createScale(sortedEntries);

  return {
    rows: sortedEntries.map((entry, index) => {
      const entryDuration = Math.max(
        0,
        getEntryEndTime(entry) - entry.startTime,
      );
      const startOffset = entry.startTime - startTime;
      const visualStart = getVisualTime(entry.startTime, scale);
      const visualEnd = getVisualTime(getEntryEndTime(entry), scale);
      const offsetPercent = clampPercent(
        (visualStart / scale.visualDuration) * 100,
      );
      const widthPercent = clampPercent(
        ((visualEnd - visualStart) / scale.visualDuration) * 100,
      );

      return {
        id: getEntryKey(entry, index),
        entry,
        index,
        typeLabel: getEntryTypeLabel(entry),
        startOffset,
        visualStartOffset: visualStart,
        duration: entryDuration,
        offsetPercent,
        widthPercent,
        valueLabel: getEntryValueLabel(entry),
        phases:
          entry.entryType === 'resource' ? getResourcePhaseSegments(entry) : [],
      };
    }),
    ticks: createTicks(scale),
    gaps: scale.gaps.map((gap, index) => ({
      id: `gap:${index}:${gap.start}`,
      label: `${formatDuration(gap.end - gap.start)} idle`,
      startOffset: gap.start - startTime,
      duration: gap.end - gap.start,
      offsetPercent: clampPercent(
        (gap.visualStart / scale.visualDuration) * 100,
      ),
      widthPercent: clampPercent(
        (gap.visualDuration / scale.visualDuration) * 100,
      ),
    })),
    startTime,
    duration,
    timelineDuration: scale.visualDuration,
    hasCompressedGaps: scale.gaps.some(
      (gap) => gap.end - gap.start > scale.gapThreshold,
    ),
  };
};
