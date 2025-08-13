import { useEffect, useState } from 'react';
import { Text } from '@radix-ui/themes';

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
    if (!isActive) {
      return;
    }

    setCurrentTime(Date.now());
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (duration: number) => {
    return `${Math.round(duration)}s`;
  };

  const getSessionDuration = () => {
    if (!currentTime || !sessionStartedAt) return 0;
    return currentTime - sessionStartedAt;
  };

  return (
    <>
      <Text size="2" color="gray">
        Session started:{' '}
        {sessionStartedAt ? formatTime(sessionStartedAt) : 'Not started'}
      </Text>
      {!!sessionStartedAt && (
        <Text size="2" color="gray">
          Duration: {formatDuration(getSessionDuration() / 1000)}
        </Text>
      )}
    </>
  );
};
