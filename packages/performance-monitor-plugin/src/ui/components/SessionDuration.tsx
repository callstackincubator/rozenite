import { useEffect, useState } from 'react';
import { Surface } from '@rozenite/ui';
import { formatDuration, formatTime } from '../utils';

export type SessionDurationProps = {
  isActive: boolean;
  sessionStartedAt: number;
};

export const SessionDuration = ({
  isActive,
  sessionStartedAt,
}: SessionDurationProps) => {
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionStartedAt) {
      setCurrentTime(null);
      return;
    }

    setCurrentTime(Date.now());

    if (!isActive) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, sessionStartedAt]);

  const duration =
    currentTime && sessionStartedAt ? currentTime - sessionStartedAt : 0;

  return (
    <Surface
      className="min-w-0 px-3 py-2 text-xs leading-5 text-muted"
      variant="secondary"
    >
      <div className="whitespace-nowrap">
        Session started:{' '}
        <span className="tabular-nums text-foreground">
          {sessionStartedAt ? formatTime(sessionStartedAt) : 'Not started'}
        </span>
      </div>
      {sessionStartedAt ? (
        <div className="whitespace-nowrap">
          Duration:{' '}
          <span className="tabular-nums text-foreground">
            {formatDuration(duration)}
          </span>
        </div>
      ) : null}
    </Surface>
  );
};
