import { ScrollArea } from '../components/ScrollArea';
import { HttpNetworkEntry } from '../state/model';

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
    <ScrollArea className="h-full w-full">
      <div className="p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Start Time</span>
              <span className="text-foreground/70">
                {formatTimestamp(startTime)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Time To First Byte (TTFB)</span>
              <span className="text-foreground/70">{formatTime(ttfb)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">End Time</span>
              <span className="text-foreground/70">
                {endTime ? formatTimestamp(endTime) : 'Pending'}
              </span>
            </div>
          </div>

          <div className="border-t border-border/60 pt-4">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-foreground/70">Total Duration</span>
              <span className="text-foreground">{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
