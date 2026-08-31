export const formatDuration = (ms: number | undefined): string => {
  if (ms == null || Number.isNaN(ms)) {
    return '0ms';
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  if (ms >= 10) {
    return `${ms.toFixed(0)}ms`;
  }
  if (ms >= 1) {
    return `${ms.toFixed(1)}ms`;
  }
  if (ms === 0) {
    return '0ms';
  }
  return `${ms.toFixed(2)}ms`;
};

export const formatCount = (count: number): string => count.toLocaleString();

/** Milliseconds between the first recorded chain and this one. */
export const formatOffset = (startedAt: number, firstStartedAt: number): string =>
  `+${formatDuration(Math.max(0, startedAt - firstStartedAt))}`;
