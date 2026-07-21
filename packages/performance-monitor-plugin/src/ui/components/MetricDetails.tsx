import { Description } from '@rozenite/ui';
import type { SerializedPerformanceMetric } from '../../shared/types';
import {
  formatTime,
  getMetricUnit,
  getMetricValueKind,
} from '../utils';
import { DetailField, DetailsCard, DetailsDisplay } from './DetailsDisplay';

export type MetricDetailsProps = {
  metric: SerializedPerformanceMetric;
};

export const MetricDetails = ({ metric }: MetricDetailsProps) => {
  const unit = getMetricUnit(metric.detail);
  const valueKind = getMetricValueKind(metric.value);

  return (
    <div className="flex flex-col gap-4">
      <DetailsCard
        description="Metric metadata captured for this event."
        title="Overview"
      >
        <DetailField label="Name">
          <span className="font-medium text-foreground">{metric.name}</span>
        </DetailField>
        <DetailField label="Value">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all font-medium text-success">
              {String(metric.value)}
            </span>
            {unit ? (
              <Description className="text-xs text-muted">{unit}</Description>
            ) : null}
          </div>
        </DetailField>
        {unit ? <DetailField label="Unit">{unit}</DetailField> : null}
        <DetailField label="Value Type">{valueKind}</DetailField>
        <DetailField label="Recorded At">
          <span className="tabular-nums text-foreground">
            {formatTime(metric.startTime)}
          </span>
        </DetailField>
      </DetailsCard>

      <DetailsDisplay details={metric.detail} />
    </div>
  );
};
