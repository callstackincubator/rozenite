import { useMemo, type KeyboardEvent } from 'react';
import { Box, Text } from '@radix-ui/themes';
import { Virtuoso } from 'react-virtuoso';
import type { SerializedPerformanceEntry } from '../../shared/types';
import { formatDuration, formatTime } from '../utils';
import {
  buildWaterfallModel,
  formatTimelineTime,
  isSamePerformanceEntry,
  type WaterfallRow,
} from '../waterfall';

export type WaterfallViewProps = {
  entries: SerializedPerformanceEntry[];
  selectedEntry: SerializedPerformanceEntry | null;
  selectedEntryId?: string | null;
  onEntrySelect: (entry: SerializedPerformanceEntry, entryId?: string) => void;
};

const BAR_CLASS_BY_TYPE: Record<
  SerializedPerformanceEntry['entryType'],
  string
> = {
  measure: 'waterfall-bar-measure',
  mark: 'waterfall-bar-mark',
  metric: 'waterfall-bar-metric',
  'react-native-mark': 'waterfall-bar-react-native-mark',
  resource: 'waterfall-bar-resource',
};

const getDisplayName = (entry: SerializedPerformanceEntry) => {
  if (entry.entryType !== 'resource') {
    return entry.name;
  }

  try {
    const url = new URL(entry.name);
    const pathParts = url.pathname.split('/').filter(Boolean);
    return pathParts.at(-1) || url.hostname;
  } catch {
    return entry.name;
  }
};

const getDomain = (entry: SerializedPerformanceEntry) => {
  if (entry.entryType !== 'resource') {
    return null;
  }

  try {
    return new URL(entry.name).host;
  } catch {
    return null;
  }
};

const TimelineTicks = ({
  model,
  showGaps = false,
}: {
  model: ReturnType<typeof buildWaterfallModel>;
  showGaps?: boolean;
}) => {
  return (
    <>
      {showGaps &&
        model.gaps.map((gap) => (
          <span
            key={gap.id}
            className="waterfall-gap-break"
            style={{
              left: `${gap.offsetPercent}%`,
              width: `${gap.widthPercent}%`,
            }}
            title={`${gap.label} at +${formatTimelineTime(gap.startOffset)}`}
          />
        ))}
      {model.ticks.map((tick) => (
        <span
          key={`${tick.elapsedTime}:${tick.offsetPercent}`}
          className="waterfall-grid-line"
          style={{ left: `${tick.offsetPercent}%` }}
        />
      ))}
    </>
  );
};

const WaterfallBar = ({ row }: { row: WaterfallRow }) => {
  const isInstant = row.duration === 0;

  return (
    <div
      className={[
        'waterfall-bar',
        BAR_CLASS_BY_TYPE[row.entry.entryType],
        isInstant ? 'waterfall-bar-instant' : '',
      ].join(' ')}
      style={{
        left: `${row.offsetPercent}%`,
        width: `${row.widthPercent}%`,
      }}
      title={`${row.entry.name} - ${formatDuration(row.duration)}`}
    >
      {row.phases.map((phase) => (
        <span
          key={`${phase.label}:${phase.startPercent}`}
          className={`waterfall-phase ${phase.className}`}
          style={{
            left: `${phase.startPercent}%`,
            width: `${phase.widthPercent}%`,
          }}
          title={`${phase.label} - ${formatDuration(
            (phase.widthPercent / 100) * row.duration,
          )}`}
        />
      ))}
    </div>
  );
};

const isRowSelected = (
  row: WaterfallRow,
  selectedEntry: SerializedPerformanceEntry | null,
  selectedEntryId?: string | null,
) => {
  if (selectedEntryId) {
    return selectedEntryId === row.id;
  }

  return isSamePerformanceEntry(selectedEntry, row.entry);
};

export const WaterfallView = ({
  entries,
  selectedEntry,
  selectedEntryId = null,
  onEntrySelect,
}: WaterfallViewProps) => {
  const model = useMemo(() => buildWaterfallModel(entries), [entries]);

  const handleKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    row: WaterfallRow,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onEntrySelect(row.entry, row.id);
    }
  };

  if (model.rows.length === 0) {
    return (
      <Box pt="3" pl="3">
        <Text size="2" color="gray">
          No performance entries recorded
        </Text>
      </Box>
    );
  }

  return (
    <div className="waterfall-shell">
      <div className="waterfall-topbar">
        <div className="waterfall-summary">
          <strong>{model.rows.length}</strong> events
          <span>{formatTimelineTime(model.timelineDuration)} timeline</span>
          {model.hasCompressedGaps && <span>gaps normalized</span>}
        </div>
        <div className="waterfall-legend" aria-hidden="true">
          <span className="waterfall-legend-measure">Measure</span>
          <span className="waterfall-legend-resource">Resource</span>
          <span className="waterfall-legend-mark">Mark</span>
          <span className="waterfall-legend-metric">Metric</span>
          <span className="waterfall-legend-react-native-mark">
            React Native
          </span>
        </div>
      </div>

      <div className="waterfall-overview">
        <TimelineTicks model={model} showGaps />
        {model.rows.map((row, index) => (
          <span
            key={row.id}
            className={`waterfall-overview-bar ${
              BAR_CLASS_BY_TYPE[row.entry.entryType]
            }`}
            style={{
              left: `${row.offsetPercent}%`,
              width: `${Math.max(row.widthPercent, 0.18)}%`,
              top: `${6 + (index % 5) * 8}px`,
            }}
          />
        ))}
      </div>

      <div className="waterfall-ruler">
        <div className="waterfall-label-header">Events</div>
        <div className="waterfall-ruler-track">
          {model.ticks.map((tick) => (
            <span
              key={`${tick.label}:${tick.offsetPercent}`}
              className="waterfall-tick-label"
              style={{ left: `${tick.offsetPercent}%` }}
              title={tick.title}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>

      <div className="waterfall-container" role="grid" aria-label="Waterfall">
        <Virtuoso
          className="waterfall-virtual-list"
          data={model.rows}
          computeItemKey={(_, row) => row.id}
          itemContent={(_, row) => {
            const isSelected = isRowSelected(
              row,
              selectedEntry,
              selectedEntryId,
            );
            const domain = getDomain(row.entry);

            return (
              <div
                className={`waterfall-row ${
                  isSelected ? 'waterfall-row-selected' : ''
                }`}
                role="row"
                tabIndex={0}
                onClick={() => onEntrySelect(row.entry, row.id)}
                onKeyDown={(event) => handleKeyDown(event, row)}
              >
                <div className="waterfall-row-label" role="gridcell">
                  <span className="waterfall-row-index">{row.index + 1}</span>
                  <span className="waterfall-row-text">
                    <strong title={row.entry.name}>
                      {getDisplayName(row.entry)}
                    </strong>
                    {domain && <small>{domain}</small>}
                  </span>
                  <span className="waterfall-row-meta">
                    <span>{row.typeLabel}</span>
                    <span title={formatTime(row.entry.startTime)}>
                      +{formatTimelineTime(row.visualStartOffset)}
                    </span>
                    <span>{formatDuration(row.duration)}</span>
                    {row.valueLabel && <span>{row.valueLabel}</span>}
                  </span>
                </div>

                <div className="waterfall-lane" role="gridcell">
                  <TimelineTicks model={model} />
                  {isSelected && (
                    <span
                      className="waterfall-selected-guide"
                      style={{ left: `${row.offsetPercent}%` }}
                    />
                  )}
                  <WaterfallBar row={row} />
                  {isSelected && (
                    <span
                      className="waterfall-selected-duration"
                      style={{
                        left: `${Math.min(
                          98,
                          row.offsetPercent + row.widthPercent,
                        )}%`,
                      }}
                    >
                      {formatDuration(row.duration)}
                    </span>
                  )}
                </div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
};
