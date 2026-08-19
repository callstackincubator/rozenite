import { Activity } from 'lucide-react';
import { Badge, Card, DescriptionList, EmptyState, JsonInspector, ScrollArea } from '@rozenite/ui';
import type { SerializedPerformanceEntry, SerializedPerformanceResource } from '../../shared/types';
import { formatBytes, formatDuration, formatTime } from '../utils';
import { ENTRY_TYPE_LABELS } from '../entry-types';

export type DetailPaneProps = {
  entry: SerializedPerformanceEntry | null;
};

const RESOURCE_TIMING_FIELDS: Array<{
  key: keyof SerializedPerformanceResource;
  label: string;
}> = [
  { key: 'redirectStart', label: 'Redirect start' },
  { key: 'redirectEnd', label: 'Redirect end' },
  { key: 'fetchStart', label: 'Fetch start' },
  { key: 'domainLookupStart', label: 'DNS start' },
  { key: 'domainLookupEnd', label: 'DNS end' },
  { key: 'connectStart', label: 'Connect start' },
  { key: 'secureConnectionStart', label: 'TLS start' },
  { key: 'connectEnd', label: 'Connect end' },
  { key: 'requestStart', label: 'Request start' },
  { key: 'responseStart', label: 'Response start' },
  { key: 'responseEnd', label: 'Response end' },
  { key: 'workerStart', label: 'Worker start' },
];

const formatPhase = (value: number | undefined): string => {
  if (value === undefined || value === 0) return '—';
  return formatDuration(value);
};

const ResourceTimingBlock = ({ resource }: { resource: SerializedPerformanceResource }) => (
  <>
    <Card>
      <Card.Header>
        <span className="text-sm font-medium text-foreground">Sizes</span>
      </Card.Header>
      <Card.Body>
        <DescriptionList>
          <DescriptionList.Item label="Transfer size">
            {formatBytes(resource.transferSize)}
          </DescriptionList.Item>
          <DescriptionList.Item label="Encoded body">
            {formatBytes(resource.encodedBodySize)}
          </DescriptionList.Item>
          <DescriptionList.Item label="Decoded body">
            {formatBytes(resource.decodedBodySize)}
          </DescriptionList.Item>
        </DescriptionList>
      </Card.Body>
    </Card>

    <Card collapsible defaultOpen={false}>
      <Card.Header>
        <span className="text-sm font-medium text-foreground">Timing phases</span>
      </Card.Header>
      <Card.Body>
        <p className="mb-2 text-xs text-muted-foreground">
          Phase timestamps are relative to the session, not clock-shifted.
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {RESOURCE_TIMING_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="min-w-[110px] text-muted-foreground">{label}</span>
              <span className="tabular-nums text-foreground">
                {formatPhase(resource[key] as number | undefined)}
              </span>
            </div>
          ))}
        </div>
        {resource.serverTiming.length > 0 && (
          <p className="mt-3 font-mono text-xs text-foreground">
            Server timing: [{resource.serverTiming.join(', ')}]
          </p>
        )}
        {resource.workerTiming.length > 0 && (
          <p className="mt-2 font-mono text-xs text-foreground">
            Worker timing: [{resource.workerTiming.join(', ')}]
          </p>
        )}
      </Card.Body>
    </Card>
  </>
);

// Unified detail pane replacing the five per-type Details components
// (Measure/Metric/Mark/ReactNativeMark/ResourceDetails). Resource is the one
// entry shape with extra fields worth a dedicated block (per the v2 IA doc);
// everything else fits one DescriptionList plus the raw `detail` payload.
export const DetailPane = ({ entry }: DetailPaneProps) => {
  if (!entry) {
    return (
      <EmptyState
        icon={Activity}
        title="No entry selected"
        description="Select a row in the table or waterfall to see its details."
      />
    );
  }

  const isDerivedFromReactNativeMark = 'derivedFromReactNativeMark' in entry;
  const endTime = entry.startTime + entry.duration;
  const hasDetail = 'detail' in entry && entry.detail != null;
  const showsDuration = entry.entryType === 'measure' || entry.entryType === 'resource';

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="flex flex-col gap-3 p-3">
        {isDerivedFromReactNativeMark && (
          <p className="text-xs text-muted-foreground">
            Derived from paired react-native-mark Start/End entries.
          </p>
        )}

        <DescriptionList>
          <DescriptionList.Item label="Name">
            <span className="break-all">{entry.name}</span>
          </DescriptionList.Item>
          <DescriptionList.Item label="Type">
            <Badge variant="outline">{ENTRY_TYPE_LABELS[entry.entryType]}</Badge>
          </DescriptionList.Item>
          {entry.entryType === 'metric' && (
            <DescriptionList.Item label="Value">{String(entry.value)}</DescriptionList.Item>
          )}
          {entry.entryType === 'resource' && (
            <DescriptionList.Item label="Initiator">
              {entry.initiatorType ?? '—'}
            </DescriptionList.Item>
          )}
          <DescriptionList.Item label="Start">{formatTime(entry.startTime)}</DescriptionList.Item>
          {showsDuration && (
            <>
              <DescriptionList.Item label="Duration">
                {formatDuration(entry.duration)}
              </DescriptionList.Item>
              <DescriptionList.Item label="End">{formatTime(endTime)}</DescriptionList.Item>
            </>
          )}
        </DescriptionList>

        {entry.entryType === 'resource' && <ResourceTimingBlock resource={entry} />}

        {hasDetail && (
          <Card>
            <Card.Header>
              <span className="text-sm font-medium text-foreground">Detail</span>
            </Card.Header>
            <Card.Body>
              <JsonInspector data={(entry as { detail?: unknown }).detail} />
            </Card.Body>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
};
