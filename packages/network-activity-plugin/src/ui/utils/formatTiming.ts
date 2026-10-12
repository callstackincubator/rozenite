/** A duration in milliseconds, in microseconds below one millisecond. */
export const formatTime = (time: number): string => {
  if (time < 1) {
    return `${Math.round(time * 1000)} μs`;
  }
  return `${time.toFixed(1)} ms`;
};

/** A wall-clock time of day from an epoch timestamp in milliseconds, as the device reports it. */
export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString();
};
