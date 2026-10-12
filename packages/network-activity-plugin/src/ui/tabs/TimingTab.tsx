import { DescriptionList, Separator, Text } from '@rozenite/ui';
import { TabContent } from '../components/TabContent';
import { HttpNetworkEntry } from '../state/model';
import { formatTime, formatTimestamp } from '../utils/formatTiming';

export type TimingTabProps = {
  selectedRequest: HttpNetworkEntry;
};

export const TimingTab = ({ selectedRequest }: TimingTabProps) => {
  const startTime = selectedRequest.timestamp || 0;
  const endTime = selectedRequest.duration
    ? selectedRequest.timestamp + selectedRequest.duration
    : null;
  const ttfb = selectedRequest.ttfb || 0;
  const duration = selectedRequest.duration || 0;

  return (
    <TabContent className="gap-4">
      <DescriptionList>
        <DescriptionList.Item label="Start Time">
          <Text variant="numeric">{formatTimestamp(startTime)}</Text>
        </DescriptionList.Item>
        <DescriptionList.Item label="Time To First Byte (TTFB)">
          <Text variant="numeric">{formatTime(ttfb)}</Text>
        </DescriptionList.Item>
        <DescriptionList.Item label="End Time">
          <Text variant="numeric">{endTime ? formatTimestamp(endTime) : 'Pending'}</Text>
        </DescriptionList.Item>
      </DescriptionList>

      <Separator />

      <DescriptionList>
        <DescriptionList.Item label="Total Duration">
          <Text variant="numeric">{formatTime(duration)}</Text>
        </DescriptionList.Item>
      </DescriptionList>
    </TabContent>
  );
};
