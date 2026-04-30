import type { SerializedPerformanceMark } from '../../shared/types';
import { formatTime } from '../utils';
import { DetailField, DetailsCard, DetailsDisplay } from './DetailsDisplay';

export type MarkDetailsProps = {
  mark: SerializedPerformanceMark;
};

export const MarkDetails = ({ mark }: MarkDetailsProps) => {
  return (
    <div className="flex flex-col gap-4">
      <DetailsCard
        description="Point-in-time information captured for this performance mark."
        title="Overview"
      >
        <DetailField label="Name">
          <span className="font-medium text-foreground">{mark.name}</span>
        </DetailField>
        <DetailField label="Recorded At">
          <span className="tabular-nums text-foreground">
            {formatTime(mark.startTime)}
          </span>
        </DetailField>
      </DetailsCard>

      <DetailsDisplay details={mark.detail} />
    </div>
  );
};
