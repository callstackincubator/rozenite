import { useEffect, useState } from 'react';

export type SessionDurationProps = {
  isActive: boolean;
  sessionStartedAt: number;
};

// Renders next to the toolbar's `IndicatorDot`, so it only needs the ticking
// elapsed time — not the absolute session-start timestamp `StartupTab` used
// to show alongside it.
export const SessionDuration = ({ isActive, sessionStartedAt }: SessionDurationProps) => {
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

  if (!sessionStartedAt) {
    return <span className="text-xs text-muted-foreground">Not started</span>;
  }

  const elapsedSeconds = currentTime ? Math.round((currentTime - sessionStartedAt) / 1000) : 0;

  return (
    <span className="text-xs tabular-nums text-muted-foreground">
      {isActive ? 'Active' : 'Stopped'} · {elapsedSeconds}s
    </span>
  );
};
