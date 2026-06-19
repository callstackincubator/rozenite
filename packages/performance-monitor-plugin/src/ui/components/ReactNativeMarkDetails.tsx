import { Separator } from '@rozenite/ui';
import { SerializedPerformanceReactNativeMark } from '../../shared/types';
import { DetailField, DetailsCard, DetailsDisplay } from './DetailsDisplay';
import { formatTime } from '../utils';

export type ReactNativeMarkDetailsProps = {
  mark: SerializedPerformanceReactNativeMark;
};

export const ReactNativeMarkDetails = ({
  mark,
}: ReactNativeMarkDetailsProps) => {
  return (
    <div className="flex flex-col gap-4">
      <DetailsCard
        description="Point-in-time information captured for this React Native mark."
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
