import { Separator } from '@rozenite/ui';
import { SerializedPerformanceResource } from '../../shared/types';
import { DetailField, DetailsCard } from './DetailsDisplay';
import { formatTime, formatDuration, formatBytes } from '../utils';

export type ResourceDetailsProps = {
  resource: SerializedPerformanceResource;
};

const formatPhase = (value: number | undefined): string => {
  if (value === undefined || value === 0) return '—';
  return formatDuration(value);
};

const TIMING_FIELDS: Array<{
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

export const ResourceDetails = ({ resource }: ResourceDetailsProps) => {
  return (
    <div className="flex flex-col gap-4">
      <DetailsCard
        description="General information about this resource entry."
        title="Overview"
      >
        <DetailField label="Name">
          <span className="font-medium text-foreground" style={{ wordBreak: 'break-all' }}>
            {resource.name}
          </span>
        </DetailField>
        <DetailField label="Type">
          <span className="text-foreground">{resource.initiatorType ?? '—'}</span>
        </DetailField>
        <DetailField label="Duration">
          <span className="font-medium text-accent">
            {formatDuration(resource.duration)}
          </span>
        </DetailField>
        <DetailField label="Recorded At">
          <span className="tabular-nums text-foreground">
            {formatTime(resource.startTime)}
          </span>
        </DetailField>
      </DetailsCard>

      <DetailsCard
        description="Transfer and body size information for this resource."
        title="Sizes"
      >
        <DetailField label="Transfer size">
          <span className="tabular-nums text-foreground">
            {formatBytes(resource.transferSize)}
          </span>
        </DetailField>
        <DetailField label="Encoded body">
          <span className="tabular-nums text-foreground">
            {formatBytes(resource.encodedBodySize)}
          </span>
        </DetailField>
        <DetailField label="Decoded body">
          <span className="tabular-nums text-foreground">
            {formatBytes(resource.decodedBodySize)}
          </span>
        </DetailField>
      </DetailsCard>

      <DetailsCard
        description="Phase timestamps are relative to the session, not clock-shifted."
        title="Timing phases"
      >
        <div className="grid grid-cols-2 gap-2 px-5 py-4">
          {TIMING_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-sm text-muted" style={{ minWidth: '120px' }}>
                {label}:
              </span>
              <span className="text-sm text-foreground tabular-nums">
                {formatPhase(resource[key] as number | undefined)}
              </span>
            </div>
          ))}
        </div>
      </DetailsCard>

      {resource.serverTiming.length > 0 && (
        <DetailsCard title="Server timing">
          <div className="px-5 py-4">
            <span className="text-sm text-foreground" style={{ fontFamily: 'monospace' }}>
              [{resource.serverTiming.join(', ')}]
            </span>
          </div>
        </DetailsCard>
      )}

      {resource.workerTiming.length > 0 && (
        <DetailsCard title="Worker timing">
          <div className="px-5 py-4">
            <span className="text-sm text-foreground" style={{ fontFamily: 'monospace' }}>
              [{resource.workerTiming.join(', ')}]
            </span>
          </div>
        </DetailsCard>
      )}
    </div>
  );
};
