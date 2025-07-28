import { ScrollArea } from '../components/ScrollArea';
import { NetworkRequest } from '../components/RequestList';
import { NetworkEntry } from '../types';

export type TimingTabProps = {
  selectedRequest: NetworkRequest | null;
  networkEntries: Map<string, NetworkEntry>;
};

export const TimingTab = ({
  selectedRequest,
  networkEntries,
}: TimingTabProps) => {
  const networkEntry = selectedRequest
    ? networkEntries.get(selectedRequest.id)
    : null;

  if (!selectedRequest || !networkEntry) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Select a request to view timing information
      </div>
    );
  }

  const startTime = networkEntry.startTime || 0;
  const endTime = networkEntry.endTime || 0;
  const ttfb = networkEntry.ttfb || 0;
  const duration = networkEntry.duration || 0;

  const formatTime = (time: number): string => {
    if (time < 1) {
      return `${Math.round(time * 1000)} μs`;
    }
    return `${time.toFixed(1)} ms`;
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  return (
    <ScrollArea className="h-full p-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Start Time</span>
            <span className="text-gray-300">{formatTimestamp(startTime)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Time To First Byte (TTFB)</span>
            <span className="text-gray-300">{formatTime(ttfb)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">End Time</span>
            <span className="text-gray-300">
              {endTime ? formatTimestamp(endTime) : 'Pending'}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-4">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-gray-300">Total Duration</span>
            <span className="text-gray-100">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
