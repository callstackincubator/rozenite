import type { SerializedPerformanceMeasure } from '../../shared/types';
import { formatDuration, formatTime } from '../utils';
import { DetailField, DetailsCard, DetailsDisplay } from './DetailsDisplay';

export type MeasureDetailsProps = {
  measure: SerializedPerformanceMeasure;
};

export const MeasureDetails = ({ measure }: MeasureDetailsProps) => {
  const endTime = measure.startTime + measure.duration;

  return (
    <div className="flex flex-col gap-4">
      {'derivedFromReactNativeMark' in measure && (
        <p className="text-xs text-muted">
          Derived from paired react-native-mark Start/End entries.
        </p>
      )}

      <DetailsCard
        description="Timing information captured for this performance measure."
        title="Overview"
      >
        <DetailField label="Name">
          <span className="font-medium text-foreground">{measure.name}</span>
        </DetailField>
        <DetailField label="Duration">
          <span className="font-medium text-accent">
            {formatDuration(measure.duration)}
          </span>
        </DetailField>
        <DetailField label="Start Time">
          <span className="tabular-nums text-foreground">
            {formatTime(measure.startTime)}
          </span>
        </DetailField>
        <DetailField label="End Time">
          <span className="tabular-nums text-foreground">
            {formatTime(endTime)}
          </span>
        </DetailField>
      </DetailsCard>

      <DetailsDisplay details={measure.detail} />
    </div>
  );
};
